import { logger } from 'firebase-functions';
import { Timestamp } from 'firebase-admin/firestore';
import { addDays, bookingStartMs, istNow, toHHmm } from '../../../shared/src';
import type { BaseDeps } from '../razorpay/types';
import type { ReminderProvider } from './provider';

export interface ReminderRun {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Reminds customers about confirmed bookings starting within `leadHours`. Idempotent: a booking is marked
 * `reminderSentAt` only after the provider reports it as sent, and re-checked inside a transaction so two
 * overlapping runs cannot both send.
 */
export async function sendDueReminders(d: BaseDeps, provider: ReminderProvider, leadHours = 24): Promise<ReminderRun> {
  const now = d.now();
  const today = istNow(now).date;
  const q = await d.db
    .collectionGroup('bookings')
    .where('status', '==', 'confirmed')
    .where('date', 'in', [today, addDays(today, 1), addDays(today, 2)])
    .get();

  const run: ReminderRun = { considered: 0, sent: 0, skipped: 0, failed: 0 };
  const salonNames = new Map<string, string>();

  for (const doc of q.docs) {
    const b = doc.data();
    if (b['reminderSentAt']) continue;
    const hoursUntil = (bookingStartMs(b['date'], b['start']) - now.getTime()) / 3_600_000;
    if (hoursUntil <= 0 || hoursUntil > leadHours) continue;
    if (!/^\d{10}$/.test(b['customerPhone'] ?? '')) continue;
    run.considered++;

    const salonId = doc.ref.parent.parent!.id;
    if (!salonNames.has(salonId)) salonNames.set(salonId, (await d.db.doc(`salons/${salonId}`).get()).get('profile.name') ?? '');

    try {
      const result = await provider.send({
        to: b['customerPhone'],
        template: 'booking-reminder',
        params: {
          salonName: salonNames.get(salonId)!,
          customerName: b['customerName'],
          date: b['date'],
          time: toHHmm(b['start']),
          services: ((b['services'] ?? []) as { name: string }[]).map((s) => s.name).join(' + '),
        },
      });
      if (result === 'skipped') {
        run.skipped++;
        continue;
      }
      const marked = await d.db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (fresh.get('reminderSentAt') || fresh.get('status') !== 'confirmed') return false;
        tx.update(doc.ref, { reminderSentAt: Timestamp.fromDate(now) });
        return true;
      });
      if (marked) run.sent++;
    } catch (e) {
      run.failed++;
      logger.warn('reminder send failed', { salonId, bookingId: doc.id, kind: e instanceof Error ? e.name : 'unknown' });
    }
  }
  if (run.considered) logger.info('reminder run', { ...run, provider: provider.name });
  return run;
}
