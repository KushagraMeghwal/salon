import { TestBed } from '@angular/core/testing';
import { FirebaseService } from '../firebase/firebase.service';
import { Booking, CatalogService, StaffMember } from '../models';
import { AvailabilityService } from './availability.service';
import { SalonStore } from './salon.store';
import { ToastService } from './toast.service';

// 2026-09-16 is a Wednesday. Salon open 09:00-21:00, break 13:00-14:00, buffer 10 min.
const WED = '2026-09-16';

const svc = (id: string, price: number, duration: number): CatalogService => ({
  id, name: id, category: 'Hair', description: '', suggestedPrice: price, suggestedDuration: duration, durationOptions: [duration], selected: true, price, duration,
});
const person = (id: string, serviceIds: string[]): StaffMember => ({
  id, name: id, role: 'Stylist', title: 'Stylist', phone: '', email: '', serviceIds, days: [true, true, true, true, true, true, false], commission: 10, photo: null, status: 'on-duty', active: true,
});

describe('Availability rules', () => {
  let store: SalonStore;
  let avail: AvailabilityService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FirebaseService, useValue: {} },
        { provide: ToastService, useValue: { error: () => undefined, info: () => undefined, success: () => undefined } },
      ],
    });
    store = TestBed.inject(SalonStore);
    avail = TestBed.inject(AvailabilityService);
    store.mode.set('owner');
    store.salonId.set('salon1');
    store.services.set([svc('s1', 450, 45), svc('s2', 250, 25), svc('s3', 2800, 90)]);
    store.staffAll.set([person('st1', ['s1', 's2']), person('st2', ['s1', 's2', 's3']), person('st4', ['s3'])]);
    store.bookings.set([]);
  });

  const book = (staffId: string, start: number, duration = 60): Booking => ({
    id: `${staffId}-${start}`, date: WED, staffId, client: 'X', phone: '', serviceName: 'Cut', start, duration, price: 500, status: 'confirmed',
  });

  it('generates slots from service duration plus buffer and skips the break', () => {
    const slots = avail.slots(WED, { serviceIds: ['s1'] });
    expect(slots[0].start).toBe(9 * 60);
    expect(slots[1].start).toBe(9 * 60 + 55); // 45 min service + 10 min buffer
    expect(slots.every((s) => !(s.start < 14 * 60 && s.start + 45 > 13 * 60))).toBe(true);
    expect(slots.at(-1)!.start + 45).toBeLessThanOrEqual(21 * 60);
  });

  it('only offers stylists who perform every selected service', () => {
    const ids = new Set(avail.slots(WED, { serviceIds: ['s3'] }).flatMap((s) => s.staffIds));
    expect(ids).toEqual(new Set(['st2', 'st4']));
  });

  it('marks a slot as booked when every eligible stylist is taken, and hides it when busy slots are not requested', () => {
    store.bookings.set([book('st1', 9 * 60), book('st2', 9 * 60)]);
    const all = avail.slots(WED, { serviceIds: ['s1'], includeBusy: true });
    expect(all[0]).toMatchObject({ start: 9 * 60, staffIds: [] });
    const free = avail.slots(WED, { serviceIds: ['s1'] });
    expect(free[0].start).toBe(9 * 60 + 110); // 09:00 and 09:55 overlap both bookings, 10:50 is free
  });

  it('reports when a busy stylist is next free', () => {
    store.bookings.set([book('st1', 9 * 60, 60)]);
    expect(avail.busyStaff(WED, ['s1'], 9 * 60, 45)).toEqual([{ staffId: 'st1', freeAt: 10 * 60 }]);
  });

  it('closes a day for a full-day holiday and shortens a half-day one', () => {
    store.addHoliday({ date: WED, name: 'Diwali', type: 'full' });
    expect(avail.slots(WED, { serviceIds: ['s1'] })).toEqual([]);
    expect(store.checkBooking(WED, 'st1', 600, 30)).toMatch(/closed/i);

    store.removeHoliday(store.settings().holidays.find((h) => h.date === WED)!.id);
    store.addHoliday({ date: WED, name: 'Half', type: 'half', closeAt: '13:00' });
    expect(avail.slots(WED, { serviceIds: ['s1'] }).at(-1)!.start + 45).toBeLessThanOrEqual(13 * 60);
  });

  it('ignores the booking being rescheduled when checking its new time', () => {
    const mine = book('st1', 9 * 60, 60);
    store.bookings.set([mine]);
    const slots = avail.slots(WED, { duration: 60, staffId: 'st1', ignoreBookingId: mine.id, includeBusy: true });
    expect(slots.find((s) => s.start === 9 * 60)?.staffIds).toEqual(["st1"]);
    const blocked = avail.slots(WED, { duration: 60, staffId: 'st1', includeBusy: true });
    expect(blocked.find((s) => s.start === 9 * 60)?.staffIds).toEqual([]);
  });

  describe('best time for the customer', () => {
    const slot = (start: number, staff: number) => ({ start, staffIds: Array.from({ length: staff }, (_, i) => `s${i}`), period: 'morning' as const });

    it('picks the free slot closest to the hour the customer usually books', () => {
      const best = avail.bestSlot([slot(540, 1), slot(660, 1), slot(900, 1), slot(1080, 1)], [11 * 60, 11 * 60 + 30, 17 * 60]);
      expect(best?.slot.start).toBe(660);
      expect(best?.pref).toBe(11 * 60 + 30);
    });

    it('for a new customer picks the quietest time: the most stylists free, earliest first', () => {
      const best = avail.bestSlot([slot(540, 1), slot(600, 3), slot(660, 3), slot(720, 2)], []);
      expect(best?.slot.start).toBe(600);
      expect(best?.pref).toBeNull();
    });

    it('never suggests a booked slot, and suggests nothing when there is no choice', () => {
      expect(avail.bestSlot([slot(540, 0), slot(600, 2)], [9 * 60])).toBeNull();
      expect(avail.bestSlot([slot(540, 0), slot(600, 0)], [])).toBeNull();
    });
  });
});
