import { GSTIN_PATTERN, splitGst } from './gst';

describe('gst', () => {
  it('returns no tax when not registered', () => {
    expect(splitGst(1180, false)).toEqual({ taxable: 1180, cgst: 0, sgst: 0, gst: 0 });
  });
  it('extracts 18% from an inclusive amount', () => {
    const r = splitGst(1180, true);
    expect(r).toEqual({ taxable: 1000, cgst: 90, sgst: 90, gst: 180 });
  });
  it('always adds back up to the total', () => {
    for (const t of [1, 99, 450, 1234, 99999]) {
      const r = splitGst(t, true);
      expect(r.taxable + r.cgst + r.sgst).toBe(t);
    }
  });
  it('validates GSTIN format', () => {
    expect(GSTIN_PATTERN.test('27ABCDE1234F1Z5')).toBe(true);
    expect(GSTIN_PATTERN.test('27abcde1234f1z5')).toBe(false);
    expect(GSTIN_PATTERN.test('12345')).toBe(false);
  });
});
