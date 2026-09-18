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

  const LINES = [
    { serviceId: 's1', name: 'Cut', price: 850, qty: 1, staffId: 'st1' },
    { serviceId: 's3', name: 'Spa', price: 1250, qty: 1, staffId: 'st1' },
  ];

  it('does not add GST to the bill when the salon is not registered', () => {
    store.settings.update((s) => ({ ...s, gstRegistered: false, gstin: '' }));
    const bill = store.createBill({ client: 'Ananya Roy', phone: '', method: 'UPI', discount: 0, lines: LINES });
    expect(bill.subtotal).toBe(2100);
    expect(bill.total).toBe(2100);
    expect(bill.gst).toBe(0);
    expect(bill.gstRegistered).toBe(false);
    expect(bill.no).toMatch(/^CH\/\d{2}-\d{2}\/\d{5}$/);
  });

  it('splits an inclusive total into taxable value + CGST/SGST when registered', () => {
    store.settings.update((s) => ({ ...s, gstRegistered: true, gstin: '27ABCDE1234F1Z5' }));
    const bill = store.createBill({ client: 'Ananya Roy', phone: '', method: 'UPI', discount: 0, lines: LINES });
    expect(bill.total).toBe(2100); // price already includes GST
    expect(bill.taxable).toBe(1780);
    expect(bill.cgst + bill.sgst).toBe(320);
    expect(bill.taxable + bill.cgst + bill.sgst).toBe(bill.total);
    expect(bill.gstin).toBe('27ABCDE1234F1Z5');
  });

  it('applies coupons before the tax split', () => {
    store.settings.update((s) => ({ ...s, gstRegistered: true, gstin: '27ABCDE1234F1Z5' }));
    const r = store.applyCoupon('welcome10', 2100);
    expect(r.ok && r.discount).toBe(210);
    expect(store.applyCoupon('NOPE', 2100).ok).toBe(false);
    const bill = store.createBill({ client: 'A', phone: '', method: 'Cash', discount: 210, couponCode: 'WELCOME10', lines: LINES });
    expect(bill.total).toBe(1890);
    expect(bill.taxable + bill.cgst + bill.sgst).toBe(1890);
  });

  it('keys customer records by phone (p_<last10>), so walk-ins and repeat visits share one record', () => {
    const before = store.customers().length;
    store.touchCustomer('Amit', '+91 90000 11111', { visit: true, spent: 400 });
    store.touchCustomer('Amit S', '9000011111', { visit: true, spent: 100 }, 'uid-1');
    const rec = store.customers().filter((c) => c.id === 'p_9000011111');
    expect(rec).toHaveLength(1);
    expect(store.customers().length).toBe(before + 1);
    expect(rec[0]).toMatchObject({ visits: 2, totalSpent: 500, uid: 'uid-1', name: 'Amit' });
    store.touchCustomer('Walk In Guest', '', { visit: true, spent: 50 });
    expect(store.customers().some((c) => c.id === 'n_walk-in-guest')).toBe(true);
    expect(store.noShowsOf('090000 11111')).toBe(0);
  });

  it('issues sequential invoice numbers', () => {
    const line = [{ serviceId: 's1', name: 'Cut', price: 100, qty: 1, staffId: 'st1' }];
    const a = store.createBill({ client: 'A', phone: '', method: 'Cash', discount: 0, lines: line });
    const b = store.createBill({ client: 'B', phone: '', method: 'Cash', discount: 0, lines: line });
    expect(Number(b.no.split('/').pop())).toBe(Number(a.no.split('/').pop()) + 1);
  });

  it('updates the customer record on billing and counts no-shows', () => {
    const before = store.customers().find((c) => c.phone.replace(/\D/g, '').endsWith('9876543210'))!;
    store.createBill({ client: before.name, phone: '9876543210', method: 'Cash', discount: 0, lines: [{ serviceId: 's1', name: 'Cut', price: 500, qty: 1, staffId: 'st1' }] });
    const after = store.customers().find((c) => c.id === before.id)!;
    expect(after.visits).toBe(before.visits + 1);
    expect(after.totalSpent).toBe(before.totalSpent + 500);

    const noShowsBefore = store.noShowsOf('9876543210');
    store.bookings.set([{ id: 'x1', date: WED, staffId: 'st1', client: before.name, phone: '9876543210', serviceName: 'Cut', start: 600, duration: 30, price: 500, status: 'confirmed' } as never]);
    store.markNoShow('x1');
    expect(store.noShowsOf('9876543210')).toBe(noShowsBefore + 1);
    expect(store.bookings()[0].status).toBe('no-show');
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
