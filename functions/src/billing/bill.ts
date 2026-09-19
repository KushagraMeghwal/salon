import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { fail, MESSAGES } from '../lib/errors';
import type { BaseDeps } from '../razorpay/types';
import { clampDiscount, customerKey, istNow, phoneKey, splitGst } from '../../../shared/src';

export type PayMethod = 'Cash' | 'UPI' | 'Card' | 'Split';

export interface BillLineInput {
  serviceId: string;
  name: string;
  price: number;
  qty: number;
  staffId: string;
}

export interface BillInput {
  salonId: string;
  client: string;
  phone: string;
  lines: BillLineInput[];
  discount: number;
  couponCode?: string;
  method: PayMethod;
  queueId?: string | null;
  bookingId?: string | null;
}

/** Financial year label for GST invoice numbering: April 2026 to March 2027 is "26-27". */
export function financialYear(date: string): string {
  const y = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/**
 * Quick Bill. Runs in one transaction: the invoice number comes from a per-salon, per-financial-year counter so two
 * devices billing at once can never issue the same number. Also stamps the queue entry / booking and the customer record.
 */
export async function createBill(d: BaseDeps, input: BillInput): Promise<Record<string, unknown>> {
  const now = d.now();
  const today = istNow(now).date;
  const fy = financialYear(today);
  const salonRef = d.db.doc(`salons/${input.salonId}`);
  const counterRef = d.db.doc(`salons/${input.salonId}/private/counters`);
  const key = customerKey(input.phone, input.client);
  const customerRef = d.db.doc(`salons/${input.salonId}/customers/${key}`);
  const queueRef = input.queueId ? d.db.doc(`salons/${input.salonId}/queue/${input.queueId}`) : null;
  const bookingRef = input.bookingId ? d.db.doc(`salons/${input.salonId}/bookings/${input.bookingId}`) : null;

  return d.db.runTransaction(async (tx: Transaction) => {
    const [salonSnap, counterSnap, customerSnap, queueSnap, bookingSnap] = await Promise.all([
      tx.get(salonRef), tx.get(counterRef), tx.get(customerRef), queueRef ? tx.get(queueRef) : null, bookingRef ? tx.get(bookingRef) : null,
    ]);
    if (!salonSnap.exists) fail('not-found', MESSAGES.notFound);
    const settings = salonSnap.get('settings') ?? {};
    const registered = settings.gstRegistered === true;

    const subtotal = input.lines.reduce((a, l) => a + l.price * l.qty, 0);
    const discount = clampDiscount(subtotal, input.discount);
    const total = subtotal - discount;
    const tax = splitGst(total, registered);

    const seq = ((counterSnap.data()?.[`inv_${fy}`] as number | undefined) ?? 0) + 1;
    const invoiceNo = `CH/${fy}/${String(seq).padStart(5, '0')}`;
    const billId = invoiceNo.replace(/\//g, '-');
    const stamp = Timestamp.fromDate(now);

    tx.set(counterRef, { [`inv_${fy}`]: seq }, { merge: true });
    tx.set(d.db.doc(`salons/${input.salonId}/bills/${billId}`), {
      invoiceNo, date: today, ...(input.bookingId ? { bookingId: input.bookingId } : {}),
      customerName: input.client, customerPhone: input.phone,
      lines: input.lines, subtotal, discount, ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, gst: tax.gst, gstRegistered: registered, ...(registered ? { gstin: settings.gstin } : {}),
      total, method: input.method, createdAt: stamp,
    });

    // Customer record: one visit, the amount spent. A booking that was already completed has counted its own visit.
    const alreadyCounted = bookingSnap?.exists && bookingSnap.get('status') === 'completed' && !bookingSnap.get('billed');
    if (!alreadyCounted) {
      const c = customerSnap.data() ?? {};
      tx.set(customerRef, {
        name: c['name'] || input.client, phone: c['phone'] || (phoneKey(input.phone) ? input.phone : ''), uid: c['uid'] ?? null,
        noShowCount: c['noShowCount'] ?? 0, visits: (c['visits'] ?? 0) + 1, totalSpent: (c['totalSpent'] ?? 0) + total, lastVisit: today,
      }, { merge: true });
    }

    if (bookingRef && bookingSnap?.exists) tx.update(bookingRef, { billed: true, status: 'completed', updatedAt: stamp });

    const stampFields = { stage: 'done', billNo: invoiceNo, payMethod: input.method, price: total, billedAt: now.toISOString(), updatedAt: stamp };
    if (queueRef && queueSnap?.exists) tx.update(queueRef, stampFields);
    else {
      const first = input.lines[0];
      tx.set(d.db.doc(`salons/${input.salonId}/queue/q_${billId}`), {
        ...stampFields, date: today, client: input.client, phone: input.phone || 'Walk-in', service: input.lines.map((l) => l.name).join(', '),
        category: 'Hair', duration: 0, requestedStaffId: null, staffId: first?.staffId ?? null, station: null, source: 'walkin',
        arrivedAt: istNow(now).minutes, startedAt: null, createdAt: stamp,
      });
    }

    return { no: invoiceNo, date: today, total, subtotal, discount, ...tax, gstRegistered: registered, gstin: registered ? settings.gstin : undefined, createdAt: now.toISOString() };
  });
}
