import { TestBed } from '@angular/core/testing';
import { AvailabilityService } from './availability.service';
import { SalonStore } from './salon.store';

// 2026-09-16 is a Wednesday. Salon open 09:00-21:00, break 13:00-14:00, buffer 10 min.
const WED = '2026-09-16';

describe('Availability and customer booking rules', () => {
  let store: SalonStore;
  let avail: AvailabilityService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    store = TestBed.inject(SalonStore);
    avail = TestBed.inject(AvailabilityService);
    store.bookings.set([]);
  });

  const book = (staffId: string, start: number, duration = 60) =>
    store.addBooking({ date: WED, staffId, client: 'X', phone: '', serviceName: 'Cut', start, duration, price: 500, status: 'confirmed' });

  it('generates slots from service duration plus buffer and skips the break', () => {
    const slots = avail.slots(WED, { serviceIds: ['s1'] });
    expect(slots[0].start).toBe(9 * 60);
    expect(slots[1].start).toBe(9 * 60 + 55); // 45 min service + 10 min buffer
    expect(slots.every((s) => !(s.start < 14 * 60 && s.start + 45 > 13 * 60))).toBe(true);
    expect(slots.at(-1)!.start + 45).toBeLessThanOrEqual(21 * 60);
  });

  it('only offers stylists who perform every selected service', () => {
    // s3 (Keratin) is done by Aarav and Sneha; Sneha does not work Wednesday? she does (Mon-Fri).
    const ids = new Set(avail.slots(WED, { serviceIds: ['s3'] }).flatMap((s) => s.staffIds));
    expect(ids).toEqual(new Set(['st2', 'st4']));
  });

  it('removes a slot when every eligible stylist is booked', () => {
    book('st1', 9 * 60);
    book('st2', 9 * 60);
    const first = avail.slots(WED, { serviceIds: ['s1'] })[0];
    expect(first.start).toBe(9 * 60 + 110); // 09:00 and 09:55 overlap both bookings, 10:50 is free
  });

  it('reports when a busy stylist is next free', () => {
    book('st1', 9 * 60, 60);
    const busy = avail.busyStaff(WED, ['s1'], 9 * 60, 45);
    expect(busy).toEqual([{ staffId: 'st1', freeAt: 10 * 60 }]);
  });

  it('closes a day for a full-day holiday and shortens a half-day one', () => {
    store.addHoliday({ date: WED, name: 'Diwali', type: 'full' });
    expect(avail.slots(WED, { serviceIds: ['s1'] })).toEqual([]);
    expect(store.checkBooking(WED, 'st1', 600, 30)).toMatch(/closed/i);

    store.removeHoliday(store.settings().holidays.find((h) => h.date === WED)!.id);
    store.addHoliday({ date: WED, name: 'Half', type: 'half', closeAt: '13:00' });
    expect(avail.slots(WED, { serviceIds: ['s1'] }).at(-1)!.start + 45).toBeLessThanOrEqual(13 * 60);
  });

  it('creates an online booking for "any" stylist and blocks the double booking', () => {
    const res = store.createOnlineBooking({ date: WED, staffId: 'any', serviceIds: ['s1', 's2'], start: 600, client: 'Ananya', phone: '98765 43210', payment: 'online' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.price).toBe(700);
    expect(res.booking.duration).toBe(70);
    expect(res.booking.paid).toBe(true);
    expect(res.booking.bookingNo).toMatch(/^CH-[A-Z]+-\d{5}$/);
    expect(['st1', 'st2']).toContain(res.booking.staffId);

    const again = store.createOnlineBooking({ date: WED, staffId: res.booking.staffId, serviceIds: ['s1'], start: 620, client: 'B', phone: '9000000000', payment: 'salon' });
    expect(again.ok).toBe(false);
  });

  it('applies the late-cancellation fee only inside the policy window', () => {
    const res = store.createOnlineBooking({ date: '2099-01-05', staffId: 'st1', serviceIds: ['s1'], start: 600, client: 'A', phone: '9000000001', payment: 'salon' });
    if (!res.ok) throw new Error(res.error);
    expect(store.cancellationFee(res.booking)).toBe(0);
    store.settings.update((s) => ({ ...s, cancelWindowHrs: 24 * 365 * 100, latePenaltyPct: 15 }));
    expect(store.cancellationFee(res.booking)).toBe(Math.round(res.booking.price * 0.15));
  });

  it('reschedules with the same stylist and rejects a clashing time', () => {
    book('st1', 9 * 60, 60);
    const res = store.createOnlineBooking({ date: WED, staffId: 'st1', serviceIds: ['s2'], start: 11 * 60, client: 'A', phone: '9000000002', payment: 'salon' });
    if (!res.ok) throw new Error(res.error);
    expect(store.rescheduleBooking(res.booking.id, WED, 9 * 60 + 15)).toMatch(/already has a booking/i);
    expect(store.rescheduleBooking(res.booking.id, WED, 15 * 60)).toBeNull();
    expect(store.bookings().find((b) => b.id === res.booking.id)?.start).toBe(15 * 60);
  });

  it('excludes cancelled bookings from availability', () => {
    const res = store.createOnlineBooking({ date: WED, staffId: 'st1', serviceIds: ['s2'], start: 11 * 60, client: 'A', phone: '9000000003', payment: 'salon' });
    if (!res.ok) throw new Error(res.error);
    expect(store.checkBooking(WED, 'st1', 11 * 60, 25)).not.toBeNull();
    store.cancelBooking(res.booking.id);
    expect(store.checkBooking(WED, 'st1', 11 * 60, 25)).toBeNull();
  });
});
