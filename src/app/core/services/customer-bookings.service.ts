import { Injectable, effect, inject, signal } from '@angular/core';
import { Unsubscribe, collectionGroup, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { Booking } from '../models';
import { AuthService } from './auth.service';
import { mapBooking } from './mappers';

/** The signed-in customer's bookings across every salon, live (Firestore collection-group query on customerId). */
@Injectable({ providedIn: 'root' })
export class CustomerBookingsService {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);

  readonly bookings = signal<Booking[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  private unsub?: Unsubscribe;
  private uid = '';

  constructor() {
    // Signing out (or switching account) must never leave the previous person's bookings in memory.
    effect(() => {
      const u = this.auth.user();
      if (!u) this.stop();
      else if (this.uid && this.uid !== u.uid) this.start();
    });
  }

  start() {
    const u = this.auth.user();
    if (!u) return;
    if (this.unsub && this.uid === u.uid) return;
    this.stop();
    this.uid = u.uid;
    this.loading.set(true);
    this.failed.set(false);
    this.unsub = onSnapshot(
      query(collectionGroup(this.fb.db, 'bookings'), where('customerId', '==', u.uid), orderBy('date', 'desc')),
      (snap) => {
        this.bookings.set(snap.docs.map((d) => mapBooking(d.id, d.data())).filter((b) => b.status !== 'expired' && b.status !== 'held'));
        this.loading.set(false);
      },
      () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    );
  }

  stop() {
    this.unsub?.();
    this.unsub = undefined;
    this.uid = '';
    this.bookings.set([]);
  }
}
