import { Injectable, computed, signal } from '@angular/core';
import { CustomerSession, Role } from '../models';

const CUSTOMER_KEY = 'chairly.customer';

/** Mock auth. Replaced by Firebase Auth (Google + Phone OTP) in the Firebase phase. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _role = signal<Role>('owner');
  readonly role = this._role.asReadonly();
  /** Which stylist is signed in when the role is `staff`. */
  readonly staffId = signal('st1');
  readonly customer = signal<CustomerSession | null>(this.loadCustomer());

  readonly user = computed(() => ({
    name: 'Ananya Sen',
    title: 'Salon Owner',
    email: 'owner@studio.com',
    role: this._role(),
  }));

  setRole(role: Role) {
    this._role.set(role);
  }

  loginCustomer(phone: string, name?: string) {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const known = digits === '9876543210';
    const session: CustomerSession = { phone: digits, name: name ?? (known ? 'Ananya Roy' : ''), noShowCount: 0 };
    this.customer.set(session);
    this.persist(session);
  }

  setCustomerName(name: string) {
    const c = this.customer();
    if (!c) return;
    const next = { ...c, name };
    this.customer.set(next);
    this.persist(next);
  }

  logoutCustomer() {
    this.customer.set(null);
    this.persist(null);
  }

  private persist(c: CustomerSession | null) {
    try {
      if (c) localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
      else localStorage.removeItem(CUSTOMER_KEY);
    } catch { /* storage unavailable */ }
  }

  private loadCustomer(): CustomerSession | null {
    try {
      const raw = localStorage.getItem(CUSTOMER_KEY);
      return raw ? (JSON.parse(raw) as CustomerSession) : null;
    } catch {
      return null;
    }
  }
}
