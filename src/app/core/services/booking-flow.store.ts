import { Injectable, computed, inject, signal } from '@angular/core';
import { SalonStore } from './salon.store';

/** State of the customer's in-progress booking (services -> slot -> stylist -> payment). */
@Injectable({ providedIn: 'root' })
export class BookingFlowStore {
  private readonly store = inject(SalonStore);

  readonly serviceIds = signal<string[]>([]);
  readonly date = signal<string | null>(null);
  readonly start = signal<number | null>(null);
  readonly staffId = signal<string>('any');
  readonly payment = signal<'online' | 'salon'>('online');

  readonly services = computed(() => this.serviceIds().map((id) => this.store.serviceById(id)).filter((s) => !!s && s.selected).map((s) => s!));
  readonly totalPrice = computed(() => this.services().reduce((a, s) => a + s.price, 0));
  readonly totalDuration = computed(() => this.services().reduce((a, s) => a + s.duration, 0));

  toggle(id: string) {
    this.serviceIds.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    // Any earlier slot/stylist choice no longer matches the services.
    this.start.set(null);
    this.staffId.set('any');
  }

  has(id: string) {
    return this.serviceIds().includes(id);
  }

  reset() {
    this.serviceIds.set([]);
    this.date.set(null);
    this.start.set(null);
    this.staffId.set('any');
    this.payment.set('online');
  }
}
