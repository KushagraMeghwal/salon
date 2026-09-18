import { Injectable, computed, signal } from '@angular/core';
import { AdminSalon, Plan, SubscriptionStatus } from '../models';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const SEED_PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', price: 499, tagline: 'For single-chair salons getting started', features: ['Up to 3 staff', 'Online booking page + QR', 'Quick Bill with GST invoices', 'Basic daily reports'] },
  { id: 'growth', name: 'Growth', price: 999, tagline: 'For busy salons that need more control', highlight: true, features: ['Up to 10 staff', 'Everything in Starter', 'Staff commissions & payouts', 'WhatsApp reminders', 'Advanced analytics'] },
  { id: 'pro', name: 'Pro', price: 1999, tagline: 'For premium studios and larger teams', features: ['Unlimited staff', 'Everything in Growth', 'Priority support', 'Custom branding', 'Data export API'] },
];

const s = (id: string, name: string, owner: string, city: string, plan: AdminSalon['plan'], status: SubscriptionStatus, trialOffset: number, joinedOffset: number, staff: number): AdminSalon => ({
  id, name, owner, city, plan, status, trialEndsAt: day(trialOffset), joinedAt: day(joinedOffset), staff, mrr: 0,
});

const SEED_SALONS: AdminSalon[] = [
  s('a1', 'Luxe Grooming Studio & Spa', 'Ananya Sen', 'Bengaluru', 'Growth', 'active', -10, -40, 4),
  s('a2', 'The Cut Lounge', 'Rohit Mehra', 'Mumbai', 'Pro', 'active', -20, -62, 12),
  s('a3', 'Glow & Go Beauty', 'Kavya Nair', 'Kochi', 'Starter', 'active', -5, -35, 3),
  s('a4', 'Barber Bros', 'Imran Qureshi', 'Hyderabad', 'Trial', 'trial', 9, -5, 2),
  s('a5', 'Velvet Salon', 'Neha Kapoor', 'Delhi', 'Trial', 'trial', 3, -11, 5),
  s('a6', 'Urban Tresses', 'Sameer Joshi', 'Pune', 'Growth', 'active', -12, -48, 7),
  s('a7', 'Zen Spa Studio', 'Pooja Iyer', 'Chennai', 'Starter', 'suspended', -30, -75, 2),
  s('a8', 'Style Junction', 'Arjun Reddy', 'Hyderabad', 'Trial', 'expired', -3, -17, 3),
  s('a9', 'Crown & Comb', 'Vikram Rathore', 'Jaipur', 'Trial', 'trial', 12, -2, 2),
  s('a10', 'Bliss Beauty Bar', 'Ritu Malhotra', 'Chandigarh', 'Growth', 'active', -8, -31, 6),
  s('a11', 'Mane Attraction', 'Divya Shah', 'Ahmedabad', 'Starter', 'active', -2, -22, 3),
  s('a12', 'Shear Genius', 'Tarun Bansal', 'Lucknow', 'Trial', 'trial', 1, -13, 2),
];

@Injectable({ providedIn: 'root' })
export class AdminStore {
  readonly plans = signal<Plan[]>(structuredClone(SEED_PLANS));
  readonly salons = signal<AdminSalon[]>(SEED_SALONS);

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

  readonly signups = [3, 5, 4, 7, 6, 9, 8, 12];

  daysLeft(iso: string) {
    return Math.ceil((new Date(iso).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  }

  setStatus(id: string, status: SubscriptionStatus) {
    this.salons.update((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  extendTrial(id: string, days: number) {
    this.salons.update((l) =>
      l.map((x) => {
        if (x.id !== id) return x;
        const base = Math.max(new Date(x.trialEndsAt).getTime(), Date.now());
        return { ...x, trialEndsAt: new Date(base + days * 86400000).toISOString().slice(0, 10), status: 'trial' as const };
      }),
    );
  }

  setPrice(planId: Plan['id'], price: number) {
    this.plans.update((l) => l.map((p) => (p.id === planId ? { ...p, price } : p)));
  }
}
