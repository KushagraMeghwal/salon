import { TestBed } from '@angular/core/testing';
import { SalonStore } from './salon.store';

// 2026-09-16 is a Wednesday: every seeded stylist except none works, salon open 09:00-21:00.
const WED = '2026-09-16';

describe('SalonStore', () => {
  let store: SalonStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    store = TestBed.inject(SalonStore);
    store.bookings.set([]);
  });

  it('computes GST-inclusive totals with a loyalty discount', () => {
    const bill = store.createBill({
      client: 'Ananya Roy', phone: '', method: 'UPI', loyaltyDiscount: 150,
      lines: [
        { serviceId: 's1', name: 'Cut', price: 850, qty: 1, staffId: 'st1' },
        { serviceId: 's3', name: 'Spa', price: 1250, qty: 1, staffId: 'st1' },
      ],
    });
    expect(bill.subtotal).toBe(2100);
    expect(bill.gst).toBe(378);
    expect(bill.total).toBe(2328);
    expect(bill.no).toMatch(/^CH\/\d{2}-\d{2}\/\d{5}$/);
  });

  it('issues sequential invoice numbers', () => {
    const line = [{ serviceId: 's1', name: 'Cut', price: 100, qty: 1, staffId: 'st1' }];
    const a = store.createBill({ client: 'A', phone: '', method: 'Cash', loyaltyDiscount: 0, lines: line });
    const b = store.createBill({ client: 'B', phone: '', method: 'Cash', loyaltyDiscount: 0, lines: line });
    expect(Number(b.no.split('/').pop())).toBe(Number(a.no.split('/').pop()) + 1);
  });

  it('rejects a booking that overlaps an existing one for the same stylist', () => {
    expect(store.addBooking({ date: WED, staffId: 'st1', client: 'A', phone: '', serviceName: 'Cut', start: 600, duration: 60, price: 500, status: 'confirmed' }).ok).toBe(true);
    const clash = store.addBooking({ date: WED, staffId: 'st1', client: 'B', phone: '', serviceName: 'Cut', start: 630, duration: 30, price: 500, status: 'confirmed' });
    expect(clash.ok).toBe(false);
    expect(store.addBooking({ date: WED, staffId: 'st2', client: 'B', phone: '', serviceName: 'Cut', start: 630, duration: 30, price: 500, status: 'confirmed' }).ok).toBe(true);
  });

  it('rejects bookings during the daily break and outside working hours', () => {
    expect(store.checkBooking(WED, 'st1', 13 * 60, 30)).toMatch(/break/i);
    expect(store.checkBooking(WED, 'st1', 8 * 60, 30)).toMatch(/hours/i);
    expect(store.checkBooking(WED, 'st1', 20 * 60 + 45, 30)).toMatch(/hours/i);
  });

  it('rejects bookings on a stylist day off', () => {
    // Priya Patel (st3) does not work Monday. 2026-09-14 is a Monday.
    expect(store.checkBooking('2026-09-14', 'st3', 600, 30)).toMatch(/not working/i);
  });

  it('finds free slots around bookings and the break', () => {
    store.addBooking({ date: WED, staffId: 'st1', client: 'A', phone: '', serviceName: 'Cut', start: 9 * 60, duration: 180, price: 500, status: 'confirmed' });
    const slots = store.freeSlots(WED, 45).filter((s) => s.staffId === 'st1');
    expect(slots[0]).toEqual({ staffId: 'st1', start: 12 * 60, end: 13 * 60 });
    expect(slots[1].start).toBe(14 * 60);
  });

  it('seats a waiting client with a free stylist and refuses when everyone is busy', () => {
    const waiting = store.queue().filter((q) => q.stage === 'waiting');
    expect(store.seat(waiting[0].id, 'st4')).toBeNull();
    expect(store.queue().find((q) => q.id === waiting[0].id)?.stage).toBe('in-chair');

    for (const m of store.staff()) store.upsertStaff({ ...m, status: 'on-duty' });
    const busy = new Set(store.queue().filter((q) => q.stage === 'in-chair').map((q) => q.staffId));
    expect(store.seat(waiting[1].id, [...busy][0] as string)).toMatch(/busy/i);
  });
});
