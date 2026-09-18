import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { environment } from '../../../environments/environment';
import { FirebaseService } from '../firebase/firebase.service';
import { SalonStore } from './salon.store';

export type PaymentConnectionStatus = 'NOT_CONNECTED' | 'PENDING' | 'CONNECTED' | 'REVOKED' | 'FAILED';

const MOCK_KEY = 'chairly.razorpay';

/**
 * Salon owner's Razorpay connection.
 *  - `live`: calls the `initiateRazorpayConnect` / `disconnectRazorpayConnect` Cloud Functions and reads the public
 *    `paymentConnection` field on the salon document. The browser only ever sees status, a masked account id and
 *    a date: never tokens or keys (those exist only in the server-only razorpayConnections collection).
 *  - `mock` (default until the app is wired to Firebase Auth + Firestore): simulates the same states locally.
 */
@Injectable({ providedIn: 'root' })
export class PaymentConnectService {
  private readonly injector = inject(Injector);
  private readonly store = inject(SalonStore);
  readonly live = environment.paymentsMode === 'live';

  readonly status = signal<PaymentConnectionStatus>('NOT_CONNECTED');
  readonly accountId = signal<string | null>(null);
  readonly connectedAt = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');

  /** e.g. acc_Abc123XyZ789 -> acc_•••••XyZ789 */
  readonly maskedAccount = computed(() => {
    const id = this.accountId();
    return id ? `${id.slice(0, 4)}•••••${id.slice(-4)}` : '';
  });
  /** Customers may pay online only when the salon is connected. Mock mode keeps the demo booking flow usable. */
  readonly onlineAvailable = computed(() => !this.live || this.status() === 'CONNECTED');

  /** TODO(Phase 4b): the salon's real Firestore id. Until the app is wired to Firestore the slug stands in. */
  private salonId() {
    return this.store.profile().slug;
  }

  constructor() {
    if (!this.live) this.loadMock();
  }

  /** Reads the current state (live: from the salon document). */
  async load(): Promise<void> {
    if (!this.live) return;
    try {
      const fb = this.injector.get(FirebaseService);
      const snap = await getDoc(doc(fb.db, `salons/${this.salonId()}`));
      const pc = snap.get('paymentConnection') as { status?: PaymentConnectionStatus; razorpayAccountId?: string | null; oauthConnectedAt?: { toDate(): Date } | null } | undefined;
      this.status.set(pc?.status ?? 'NOT_CONNECTED');
      this.accountId.set(pc?.razorpayAccountId ?? null);
      this.connectedAt.set(pc?.oauthConnectedAt ? pc.oauthConnectedAt.toDate().toISOString() : null);
    } catch {
      this.error.set('Could not load the payment connection.');
    }
  }

  async connect(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.live) {
        const fb = this.injector.get(FirebaseService);
        const res = await httpsCallable<{ salonId: string }, { url: string }>(fb.functions, 'initiateRazorpayConnect')({ salonId: this.salonId() });
        this.status.set('PENDING');
        window.location.href = res.data.url; // Razorpay's own pages handle login, KYC and consent
        return;
      }
      this.status.set('PENDING');
      this.saveMock();
      await new Promise((r) => setTimeout(r, 900));
      this.status.set('CONNECTED');
      this.accountId.set('acc_DemoSalon0001');
      this.connectedAt.set(new Date().toISOString());
      this.saveMock();
    } catch {
      this.status.set('FAILED');
      this.error.set('Razorpay connection failed. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  async disconnect(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.live) {
        const fb = this.injector.get(FirebaseService);
        await httpsCallable(fb.functions, 'disconnectRazorpayConnect')({ salonId: this.salonId() });
        await this.load();
      } else {
        this.status.set('REVOKED');
        this.accountId.set(null);
        this.connectedAt.set(null);
        this.saveMock();
      }
    } catch {
      this.error.set('Could not disconnect right now. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Called when the callback redirects back to settings with ?razorpay=connected|failed. */
  async handleReturn(flag: string | null): Promise<void> {
    if (!flag) return;
    if (this.live) await this.load();
    else if (flag === 'failed') this.status.set('FAILED');
  }

  private saveMock() {
    try {
      localStorage.setItem(MOCK_KEY, JSON.stringify({ s: this.status(), a: this.accountId(), c: this.connectedAt() }));
    } catch { /* storage unavailable */ }
  }

  private loadMock() {
    try {
      const raw = localStorage.getItem(MOCK_KEY);
      if (!raw) return;
      const v = JSON.parse(raw) as { s: PaymentConnectionStatus; a: string | null; c: string | null };
      this.status.set(v.s === 'PENDING' ? 'NOT_CONNECTED' : v.s);
      this.accountId.set(v.a);
      this.connectedAt.set(v.c);
    } catch { /* ignore */ }
  }
}
