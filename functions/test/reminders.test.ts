import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NoopReminderProvider, type ReminderMessage, type ReminderProvider, type SendResult } from '../src/reminders/provider';
import { sendDueReminders } from '../src/reminders/reminders';

// 2030-06-03 06:00Z = 11:30 IST.
const NOW = new Date('2030-06-03T06:00:00Z');
let db: Firestore;
const deps = () => ({ db, now: () => NOW });

class RecordingProvider implements ReminderProvider {
  readonly name = 'test';
  sent: ReminderMessage[] = [];
  next: SendResult | 'throw' = 'sent';
  async send(m: ReminderMessage): Promise<SendResult> {
    if (this.next === 'throw') throw new Error('boom');
    this.sent.push(m);
    return this.next;
  }
}

const booking = (over: Record<string, unknown> = {}) => ({
  status: 'confirmed', date: '2030-06-04', start: 10 * 60, customerName: 'Ananya', customerPhone: '9876543210',
  services: [{ name: 'Haircut' }, { name: 'Beard' }], createdAt: Timestamp.now(), ...over,
});

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: 'demo-chairly' });
  db = getFirestore();
});
beforeEach(async () => {
  for (const c of await db.listCollections()) await db.recursiveDelete(c);
  await db.doc('salons/s1').set({ profile: { name: 'Luxe' } });
});

describe('reminders', () => {
  it('reminds a confirmed booking starting within 24h, once', async () => {
    await db.doc('salons/s1/bookings/b1').set(booking()); // tomorrow 10:00 IST = 22.5h away
    const p = new RecordingProvider();
    expect(await sendDueReminders(deps(), p)).toMatchObject({ considered: 1, sent: 1 });
    expect(p.sent[0]).toEqual({ to: '9876543210', template: 'booking-reminder', params: { salonName: 'Luxe', customerName: 'Ananya', date: '2030-06-04', time: '10:00', services: 'Haircut + Beard' } });
    expect((await db.doc('salons/s1/bookings/b1').get()).get('reminderSentAt')).toBeTruthy();
    expect(await sendDueReminders(deps(), p)).toMatchObject({ considered: 0, sent: 0 });
    expect(p.sent).toHaveLength(1);
  });

  it('ignores bookings that are too far away, already started, or not confirmed', async () => {
    await db.doc('salons/s1/bookings/far').set(booking({ date: '2030-06-05' }));
    await db.doc('salons/s1/bookings/past').set(booking({ date: '2030-06-03', start: 9 * 60 })); // 09:00 IST, already started
    await db.doc('salons/s1/bookings/held').set(booking({ status: 'held' }));
    await db.doc('salons/s1/bookings/cancelled').set(booking({ status: 'cancelled' }));
    const p = new RecordingProvider();
    expect(await sendDueReminders(deps(), p)).toMatchObject({ considered: 0, sent: 0 });
    expect(p.sent).toHaveLength(0);
  });

  it('the default no-op provider sends nothing and leaves the booking eligible', async () => {
    await db.doc('salons/s1/bookings/b1').set(booking());
    const r = await sendDueReminders(deps(), new NoopReminderProvider());
    expect(r).toMatchObject({ considered: 1, sent: 0, skipped: 1 });
    expect((await db.doc('salons/s1/bookings/b1').get()).get('reminderSentAt')).toBeUndefined();
  });

  it('a provider failure is counted, not marked, and does not stop the other bookings', async () => {
    await db.doc('salons/s1/bookings/b1').set(booking());
    const p = new RecordingProvider();
    p.next = 'throw';
    expect(await sendDueReminders(deps(), p)).toMatchObject({ considered: 1, failed: 1, sent: 0 });
    expect((await db.doc('salons/s1/bookings/b1').get()).get('reminderSentAt')).toBeUndefined();
    p.next = 'sent';
    expect(await sendDueReminders(deps(), p)).toMatchObject({ sent: 1 });
  });

  it('skips bookings without a usable phone number', async () => {
    await db.doc('salons/s1/bookings/b1').set(booking({ customerPhone: '' }));
    expect(await sendDueReminders(deps(), new RecordingProvider())).toMatchObject({ considered: 0 });
  });
});
