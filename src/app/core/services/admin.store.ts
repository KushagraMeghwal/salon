import { Injectable, computed, inject, signal } from '@angular/core';
import { collection, doc, getCountFromServer, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../firebase/firebase.service';
import { AdminSalon, Plan, SubscriptionStatus } from '../models';
import { dateKey } from '../utils/time';
import { callableMessage } from './salon.store';

/** Default plan catalogue, used until the platform admin saves their own prices in `plans/`. */
const DEFAULT_PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', price: 499, tagline: 'For single-chair salons getting started', features: ['Up to 3 staff', 'Online booking page + QR', 'Quick Bill with GST invoices', 'Basic daily reports'] },
  { id: 'growth', name: 'Growth', price: 999, tagline: 'For busy salons that need more control', highlight: true, features: ['Up to 10 staff', 'Everything in Starter', 'Staff commissions & payouts', 'WhatsApp reminders', 'Advanced analytics'] },
  { id: 'pro', name: 'Pro', price: 1999, tagline: 'For premium studios and larger teams', features: ['Unlimited staff', 'Everything in Growth', 'Priority support', 'Custom branding', 'Data export API'] },
];

const WEEKS = 8;

/** Platform admin view over every salon (super admin only; the security rules enforce that). */
@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly fb = inject(FirebaseService);

  readonly plans = signal<Plan[]>(structuredClone(DEFAULT_PLANS));
  readonly salons = signal<AdminSalon[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  /** New salons per week for the last 8 weeks, oldest first. */
  readonly signups = signal<number[]>(Array(WEEKS).fill(0));

  /** Salons with mrr filled in from their plan's current price. */
  readonly rows = computed(() =>
    this.salons().map((x) => {
      const plan = this.plans().find((p) => p.name === x.plan);
      return { ...x, mrr: x.status === 'active' && plan ? plan.price : 0 };
    }),
  );

  readonly totals = computed(() => {
    const r = this.rows();
    return {
      salons: r.length,
      trials: r.filter((x) => x.status === 'trial').length,
      subscribers: r.filter((x) => x.status === 'active').length,
      mrr: r.reduce((a, x) => a + x.mrr, 0),
      suspended: r.filter((x) => x.status === 'suspended' || x.status === 'expired').length,
    };
  });

  readonly planCounts = computed(() =>
    this.plans().map((p) => ({ plan: p, count: this.rows().filter((x) => x.status === 'active' && x.plan === p.name).length })),
  );

  daysLeft(iso: string) {
    return Math.ceil((new Date(iso).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  }

  /** Plan prices only (public read); the owner Settings screen uses this. */
  async loadPlans() {
    try {
      const snap = await getDocs(collection(this.fb.db, 'plans'));
      if (snap.empty) return;
      const saved = new Map(snap.docs.map((d) => [d.id, d.data() as Partial<Plan>]));
      this.plans.set(DEFAULT_PLANS.map((p) => ({ ...p, ...(saved.get(p.id) ?? {}), id: p.id })));
    } catch {
      /* defaults stay */
    }
  }

  /** Loads every salon with its owner, billing and team size. */
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const db = this.fb.db;
      const [salonSnap, planSnap] = await Promise.all([getDocs(collection(db, 'salons')), getDocs(collection(db, 'plans'))]);
      if (!planSnap.empty) {
        const saved = new Map(planSnap.docs.map((d) => [d.id, d.data() as Partial<Plan>]));
        this.plans.set(DEFAULT_PLANS.map((p) => ({ ...p, ...(saved.get(p.id) ?? {}), id: p.id })));
      }
      const rows = await Promise.all(
        salonSnap.docs.map(async (s): Promise<AdminSalon & { created: Date }> => {
          const d = s.data();
          const [billing, owner, staff] = await Promise.all([
            getDoc(doc(db, `salons/${s.id}/private/billing`)),
            getDoc(doc(db, `users/${d['ownerId']}`)),
            getCountFromServer(collection(db, `salons/${s.id}/staff`)),
          ]);
          const b = billing.data();
          const created: Date = d['createdAt']?.toDate?.() ?? new Date();
          const status: SubscriptionStatus = d['status'] === 'suspended' ? 'suspended' : (b?.['status'] as SubscriptionStatus) ?? 'trial';
          return {
            id: s.id, name: d['profile']?.name ?? 'Untitled salon', owner: owner.data()?.['name'] || owner.data()?.['email'] || 'Owner', city: d['profile']?.city || '—',
            plan: (b?.['plan'] as AdminSalon['plan']) ?? 'Trial', trialEndsAt: dateKey(b?.['trialEndsAt']?.toDate?.() ?? created), status, joinedAt: dateKey(created), staff: staff.data().count, mrr: 0, created,
          };
        }),
      );
      this.salons.set(rows.map(({ created: _created, ...r }) => r));
      const weeks = Array<number>(WEEKS).fill(0);
      for (const r of rows) {
        const ago = Math.floor((Date.now() - r.created.getTime()) / (7 * 86400000));
        if (ago >= 0 && ago < WEEKS) weeks[WEEKS - 1 - ago]++;
      }
      this.signups.set(weeks);
    } catch {
      this.error.set('Could not load salons. Check that you are signed in as a platform admin.');
    } finally {
      this.loading.set(false);
    }
  }

  private async act(salonId: string, action: 'suspend' | 'reactivate' | 'extendTrial', days?: number): Promise<string | null> {
    try {
      await httpsCallable(this.fb.functions, 'adminAction')({ salonId, action, days });
      await this.load();
      return null;
    } catch (e) {
      return callableMessage(e);
    }
  }

  suspend(id: string) {
    return this.act(id, 'suspend');
  }
  reactivate(id: string) {
    return this.act(id, 'reactivate');
  }
  extendTrial(id: string, days: number) {
    return this.act(id, 'extendTrial', days);
  }

  async setPrice(planId: Plan['id'], price: number) {
    this.plans.update((l) => l.map((p) => (p.id === planId ? { ...p, price } : p)));
    const p = this.plans().find((x) => x.id === planId)!;
    await setDoc(doc(this.fb.db, `plans/${planId}`), { name: p.name, price: p.price, tagline: p.tagline, features: p.features, highlight: !!p.highlight });
  }
}
