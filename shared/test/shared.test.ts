import { describe, expect, it } from 'vitest';
import {
  GSTIN_PATTERN, addDays, bookingStartMs, cancellationFee, checkSalonRules, clampDiscount, customerKey, effectiveTiming, istNow, overlaps,
  phoneKey, priceServices, slotStarts, splitGst, toHHmm, toMin, toPaise, weekdayIndex,
} from '../src';

const open = { open: true, start: '09:00', end: '21:00' };

describe('gst', () => {
  it('does nothing when not registered', () => expect(splitGst(1180, false)).toEqual({ taxable: 1180, cgst: 0, sgst: 0, gst: 0 }));
  it('extracts 18% from an inclusive amount and always adds back up', () => {
    expect(splitGst(1180, true)).toEqual({ taxable: 1000, cgst: 90, sgst: 90, gst: 180 });
    for (const t of [1, 99, 450, 1234, 99999]) {
      const r = splitGst(t, true);
      expect(r.taxable + r.cgst + r.sgst).toBe(t);
    }
  });
  it('validates GSTIN format', () => {
    expect(GSTIN_PATTERN.test('27ABCDE1234F1Z5')).toBe(true);
    expect(GSTIN_PATTERN.test('27abcde1234f1z5')).toBe(false);
  });
});

describe('pricing', () => {
  const svc = [
    { serviceId: 'a', name: 'Cut', price: 500, duration: 60 },
    { serviceId: 'b', name: 'Beard', price: 250.5, duration: 30 },
  ];
  it('sums GST-inclusive prices and converts to paise', () => {
    expect(priceServices(svc)).toEqual({ price: 750.5, duration: 90, amountPaise: 75050 });
    expect(toPaise(0.1 + 0.2)).toBe(30); // no float drift
  });
  it('clamps discounts', () => {
    expect(clampDiscount(500, 900)).toBe(500);
    expect(clampDiscount(500, -5)).toBe(0);
    expect(clampDiscount(500, 50)).toBe(50);
  });
});

describe('time', () => {
  it('round-trips HH:mm', () => {
    expect(toMin('09:30')).toBe(570);
    expect(toHHmm(570)).toBe('09:30');
  });
  it('weekday index is Monday-based and timezone independent', () => {
    expect(weekdayIndex('2030-06-03')).toBe(0); // Monday
    expect(weekdayIndex('2030-06-09')).toBe(6); // Sunday
  });
  it('addDays crosses month and year ends', () => {
    expect(addDays('2030-01-31', 1)).toBe('2030-02-01');
    expect(addDays('2030-12-31', 2)).toBe('2031-01-02');
    expect(addDays('2030-03-01', -1)).toBe('2030-02-28');
  });
  it('IST conversion', () => {
    expect(istNow(new Date('2030-06-03T06:00:00Z'))).toEqual({ date: '2030-06-03', minutes: 11 * 60 + 30 });
    expect(istNow(new Date('2030-06-03T20:00:00Z'))).toEqual({ date: '2030-06-04', minutes: 1 * 60 + 30 }); // crosses midnight IST
    expect(bookingStartMs('2030-06-03', 11 * 60 + 30)).toBe(new Date('2030-06-03T06:00:00Z').getTime());
  });
});

describe('schedule rules', () => {
  const timings = Array.from({ length: 7 }, () => ({ ...open }));
  it('applies holidays: full closes the day, half moves the closing time', () => {
    expect(effectiveTiming(timings, [{ date: '2030-06-05', type: 'full' }], '2030-06-05').open).toBe(false);
    expect(effectiveTiming(timings, [{ date: '2030-06-05', type: 'half', closeAt: '14:00' }], '2030-06-05')).toMatchObject({ open: true, end: '14:00' });
    expect(effectiveTiming(timings, [{ date: '2030-06-05', type: 'full' }], '2030-06-06').open).toBe(true);
  });
  it('checks closed, hours and break in that order', () => {
    const brk = { enabled: true, start: '13:00', end: '14:00', blockSlots: true };
    expect(checkSalonRules({ ...open, open: false }, brk, 600, 30)).toBe('closed');
    expect(checkSalonRules(open, brk, 8 * 60, 30)).toBe('hours');
    expect(checkSalonRules(open, brk, 20 * 60 + 45, 30)).toBe('hours');
    expect(checkSalonRules(open, brk, 13 * 60, 30)).toBe('break');
    expect(checkSalonRules(open, { ...brk, blockSlots: false }, 13 * 60, 30)).toBeNull();
    expect(checkSalonRules(open, brk, 10 * 60, 60)).toBeNull();
  });
  it('overlap is half-open (back-to-back is fine)', () => {
    expect(overlaps(600, 660, 660, 720)).toBe(false);
    expect(overlaps(600, 661, 660, 720)).toBe(true);
  });
  it('slotStarts respects step, close and earliest', () => {
    expect(slotStarts({ open: 540, close: 660, duration: 60, step: 30 })).toEqual([540, 570, 600]);
    expect(slotStarts({ open: 540, close: 660, duration: 60, step: 30, earliest: 580 })).toEqual([600]);
    expect(slotStarts({ open: 540, close: 550, duration: 60, step: 30 })).toEqual([]);
  });
  it('late-cancellation fee', () => {
    expect(cancellationFee({ price: 1000, hoursUntil: 1, cancelWindowHrs: 2, latePenaltyPct: 15 })).toBe(150);
    expect(cancellationFee({ price: 1000, hoursUntil: 2, cancelWindowHrs: 2, latePenaltyPct: 15 })).toBe(0);
  });
});

describe('customer key', () => {
  it('is p_<last 10 digits>, whatever the phone format', () => {
    for (const p of ['+91 98765 43210', '9876543210', '098765-43210', '+919876543210']) expect(customerKey(p, 'A')).toBe('p_9876543210');
    expect(phoneKey('12345')).toBe('');
  });
  it('falls back to a name slug when there is no usable phone', () => {
    expect(customerKey('', 'Ananya Roy')).toBe('n_ananya-roy');
    expect(customerKey('Walk-in', '')).toBe('n_guest');
  });
});
