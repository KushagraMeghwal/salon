/** The 10 digits identifying an Indian mobile number, or '' when there are fewer than 10 digits. */
export function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

/**
 * Document id of a per-salon customer record: `salons/{id}/customers/{customerKey}`.
 * Keyed by phone (`p_<last10digits>`) so walk-ins, online bookings and repeat visits all land on one record.
 * A customer without a usable phone falls back to `n_<name slug>` (walk-ins entered by name only).
 */
export function customerKey(phone: string, name = ''): string {
  const p = phoneKey(phone);
  if (p) return `p_${p}`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `n_${slug || 'guest'}`;
}
