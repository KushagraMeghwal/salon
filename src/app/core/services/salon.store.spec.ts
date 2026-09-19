import { TestBed } from '@angular/core/testing';
import { FirebaseService } from '../firebase/firebase.service';
import { Bill, Booking, QueueItem, StaffMember } from '../models';
import { SalonStore } from './salon.store';
import { ToastService } from './toast.service';

// 2026-09-16 is a Wednesday. Salon open 09:00-21:00 with a 13:00-14:00 break (the store defaults).
const WED = '2026-09-16';
const MON = '2026-09-14';

const person = (id: string, days: boolean[]): StaffMember => ({
  id, name: id, role: 'Stylist', title: 'Stylist', phone: '', email: '', serviceIds: ['s1'], days, commission: 10, photo: null, status: 'on-duty', active: true,
});
const booking = (over: Partial<Booking>): Booking => ({
  id: 'b1', date: WED, staffId: 'st1', client: 'A', phone: '', serviceName: 'Cut', start: 600, duration: 60, price: 500, status: 'confirmed', ...over,
});

describe('SalonStore client-side rules', () => {
  let store: SalonStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FirebaseService, useValue: {} },
        { provide: ToastService, useValue: { error: () => undefined, info: () => undefined, success: () => undefined } },
      ],
    });
    store = TestBed.inject(SalonStore);
    store.mode.set('owner');
    store.salonId.set('salon1');
    store.staffAll.set([
      person('st1', [true, true, true, true, true, true, false]),
      person('st2', [true, true, true, true, true, true, false]),
      person('st3', [false, false, true, true, true, true, true]), // no Monday / Tuesday
    ]);
    store.bookings.set([]);
  });

  it('rejects a booking that overlaps an existing one for the same stylist, allows another stylist', () => {
    store.bookings.set([booking({ start: 600, duration: 60 })]);
    expect(store.checkBooking(WED, 'st1', 630, 30)).toMatch(/already has a booking/i);
    expect(store.checkBooking(WED, 'st2', 630, 30)).toBeNull();
    expect(store.checkBooking(WED, 'st1', 660, 30)).toBeNull(); // back-to-back is fine
  });

  it('rejects bookings during the daily break and outside working hours', () => {
    expect(store.checkBooking(WED, 'st1', 13 * 60, 30)).toMatch(/break/i);
    expect(store.checkBooking(WED, 'st1', 8 * 60, 30)).toMatch(/hours/i);
    expect(store.checkBooking(WED, 'st1', 20 * 60 + 45, 30)).toMatch(/hours/i);
  });

  it('rejects bookings on a stylist day off', () => {
    expect(store.checkBooking(MON, 'st3', 600, 30)).toMatch(/not working/i);
  });

  it('frees the slot again once a booking is cancelled, expired or a no-show', () => {
    for (const status of ['cancelled', 'expired', 'no-show'] as const) {
      store.bookings.set([booking({ status })]);
      expect(store.checkBooking(WED, 'st1', 600, 30)).toBeNull();
    }
    store.bookings.set([booking({ status: 'held' })]); // a slot held for payment still blocks
    expect(store.checkBooking(WED, 'st1', 600, 30)).not.toBeNull();
  });

  it('finds free slots around bookings and the break', () => {
    store.bookings.set([booking({ start: 9 * 60, duration: 180 })]);
    const slots = store.freeSlots(WED, 45).filter((s) => s.staffId === 'st1');
    expect(slots[0]).toEqual({ staffId: 'st1', start: 12 * 60, end: 13 * 60 });
    expect(slots[1].start).toBe(14 * 60);
  });

  it('applies the late-cancellation fee only inside the policy window', () => {
    const far = booking({ date: '2099-01-05', price: 1000 });
    expect(store.cancellationFee(far)).toBe(0);
    store.settings.update((s) => ({ ...s, cancelWindowHrs: 24 * 365 * 100, latePenaltyPct: 15 }));
    expect(store.cancellationFee(far)).toBe(150);
  });

  it('shows the next invoice number from the bills already issued this financial year', () => {
    const d = new Date();
    const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    const fy = `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
    expect(store.nextInvoiceNo()).toBe(`CH/${fy}/00001`);
    store.bills.set([{ no: `CH/${fy}/00007` } as Bill, { no: `CH/${fy}/00003` } as Bill, { no: 'CH/20-21/00099' } as Bill]);
    expect(store.nextInvoiceNo()).toBe(`CH/${fy}/00008`);
  });

  it('applies coupons and rejects unknown codes', () => {
    const r = store.applyCoupon('welcome10', 2100);
    expect(r.ok && r.discount).toBe(210);
    expect(store.applyCoupon('NOPE', 2100).ok).toBe(false);
  });

  it('refuses to seat when every stylist is with a client, and for an unknown queue entry', () => {
    const q = (id: string, stage: QueueItem['stage'], staffId: string | null): QueueItem => ({
      id, stage, client: id, phone: '', service: 'Cut', category: 'Hair', price: 100, duration: 30, requestedStaffId: null, staffId, station: null, source: 'walkin', arrivedAt: 0, startedAt: null,
    });
    store.queue.set([q('w1', 'waiting', null), q('c1', 'in-chair', 'st1'), q('c2', 'in-chair', 'st2'), q('c3', 'in-chair', 'st3')]);
    expect(store.seat('w1')).toMatch(/currently with clients/i);
    expect(store.seat('nope')).toMatch(/not found/i);
  });

  it('reads a customer’s no-show count from the per-salon record keyed by phone', () => {
    store.customers.set([{ id: 'p_9876543210', name: 'A', phone: '+91 98765 43210', visits: 3, totalSpent: 900, lastVisit: WED, noShowCount: 2 }]);
    expect(store.noShowsOf('98765 43210')).toBe(2);
    expect(store.noShowsOf('90000 00000')).toBe(0);
  });
});
