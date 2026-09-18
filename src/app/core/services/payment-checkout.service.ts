import { Injectable, Injector, inject } from '@angular/core';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { environment } from '../../../environments/environment';
import { Booking } from '../models';
import { FirebaseService } from '../firebase/firebase.service';

export interface OnlinePaymentInput {
  salonId: string;
  salonName: string;
  requestId: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  start: number;
  customerName: string;
  customerPhone: string;
}

export class PaymentCancelled extends Error {}

interface RazorpayCheckout {
  open(): void;
  on(event: string, cb: (r: unknown) => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayCheckout;

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Customer online payment (live mode): hold the slot, ask the backend for an order (server-computed amount),
 * open Razorpay Checkout, then WAIT for the backend/webhook to flip the booking to `confirmed`.
 * The checkout "success" callback is never treated as confirmation.
 */
@Injectable({ providedIn: 'root' })
export class PaymentCheckoutService {
  private readonly injector = inject(Injector);
  readonly live = environment.paymentsMode === 'live';

  private fb() {
    return this.injector.get(FirebaseService);
  }

  /** Resolves with the booking id once Razorpay reports the payment as done in the browser. */
  async payOnline(i: OnlinePaymentInput): Promise<string> {
    const fns = this.fb().functions;
    const held = await httpsCallable<Record<string, unknown>, { bookingId: string }>(fns, 'createBooking')({
      salonId: i.salonId, requestId: i.requestId, serviceIds: i.serviceIds, staffId: i.staffId, date: i.date, start: i.start,
      customerName: i.customerName, customerPhone: i.customerPhone.replace(/\D/g, '').slice(-10),
    });
    const bookingId = held.data.bookingId;
    // No amount is sent: the server prices the booking from the salon's own catalogue.
    const order = await httpsCallable<{ salonId: string; bookingId: string }, { orderId: string; amount: number; currency: string; keyId: string }>(
      fns, 'createPaymentOrder',
    )({ salonId: i.salonId, bookingId });

    await this.loadCheckout();
    const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
    if (!Razorpay) throw new Error('checkout-unavailable');
    await new Promise<void>((resolve, reject) => {
      const rzp = new Razorpay({
        key: order.data.keyId,
        order_id: order.data.orderId,
        amount: order.data.amount,
        currency: order.data.currency,
        name: i.salonName,
        prefill: { name: i.customerName, contact: i.customerPhone },
        handler: () => resolve(),
        modal: { ondismiss: () => reject(new PaymentCancelled()) },
      });
      rzp.open();
    });
    return bookingId;
  }

  /** Listens to the booking document until the backend confirms it (webhook) or the timeout passes. */
  waitForConfirmed(salonId: string, bookingId: string, timeoutMs = 120_000): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const done = (v: Record<string, unknown> | null) => {
        clearTimeout(timer);
        unsub();
        resolve(v);
      };
      const timer = setTimeout(() => done(null), timeoutMs);
      const unsub = onSnapshot(
        doc(this.fb().db, `salons/${salonId}/bookings/${bookingId}`),
        (snap) => {
          const d = snap.data();
          if (d?.['status'] === 'confirmed') done({ id: snap.id, ...d });
        },
        () => done(null),
      );
    });
  }

  /** Maps the Firestore booking to the model the booking screens already render. */
  toBooking(d: Record<string, unknown>): Booking {
    const services = (d['services'] as { name: string; price: number; duration: number }[]) ?? [];
    return {
      id: d['id'] as string,
      date: d['date'] as string,
      staffId: d['staffId'] as string,
      client: d['customerName'] as string,
      phone: d['customerPhone'] as string,
      customerPhone: d['customerPhone'] as string,
      serviceName: services.map((s) => s.name).join(' + '),
      start: d['start'] as number,
      duration: d['duration'] as number,
      price: d['price'] as number,
      status: 'confirmed',
      services: services.map((s) => ({ name: s.name, price: s.price, duration: s.duration })),
      payment: 'online',
      paid: true,
      source: 'online',
      bookingNo: d['bookingNo'] as string,
    } as Booking;
  }

  private loadCheckout(): Promise<void> {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CHECKOUT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('checkout-unavailable'));
      document.head.appendChild(s);
    });
  }
}
