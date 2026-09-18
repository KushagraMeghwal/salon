/**
 * Pure scheduling rules shared by the Angular app (instant UI feedback) and Cloud Functions (the authority).
 * No Firebase or Angular imports, no clock access: callers pass everything in.
 */
export interface DayTiming {
  open: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface HolidayLike {
  date: string; // YYYY-MM-DD
  type: 'full' | 'half';
  closeAt?: string; // HH:mm, half days
}

export interface BreakRule {
  enabled: boolean;
  start: string;
  end: string;
  blockSlots: boolean;
}

/** All salon-facing times are IST. */
export const SALON_UTC_OFFSET_MIN = 330;

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function toHHmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Monday = 0 ... Sunday = 6, from a YYYY-MM-DD salon-local date. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The salon's timing for `date`, after applying a declared holiday (full = closed, half = earlier close). */
export function effectiveTiming(timings: readonly DayTiming[], holidays: readonly HolidayLike[], date: string): DayTiming {
  const t = timings[weekdayIndex(date)];
  const h = holidays.find((x) => x.date === date);
  if (!h) return t;
  return h.type === 'full' ? { ...t, open: false } : { ...t, end: h.closeAt ?? t.end };
}

export type SalonRuleViolation = 'closed' | 'hours' | 'break';

/** Salon-level rules only (open day, working hours, daily break). Staff and overlap checks are separate. */
export function checkSalonRules(timing: DayTiming, brk: BreakRule | null | undefined, start: number, duration: number): SalonRuleViolation | null {
  if (!timing.open) return 'closed';
  if (start < toMin(timing.start) || start + duration > toMin(timing.end)) return 'hours';
  if (brk?.enabled && brk.blockSlots && start < toMin(brk.end) && start + duration > toMin(brk.start)) return 'break';
  return null;
}

/** Half-open interval overlap. */
export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && aEnd > bStart;

/** Candidate start times of `duration` minutes between open and close, stepping by `step`, none before `earliest`. */
export function slotStarts(o: { open: number; close: number; duration: number; step: number; earliest?: number }): number[] {
  const out: number[] = [];
  const earliest = o.earliest ?? 0;
  for (let start = o.open; start + o.duration <= o.close; start += o.step) {
    if (start >= earliest) out.push(start);
  }
  return out;
}

/** Late cancellation / reschedule fee under the salon policy (rupees). */
export function cancellationFee(o: { price: number; hoursUntil: number; cancelWindowHrs: number; latePenaltyPct: number }): number {
  return o.hoursUntil < o.cancelWindowHrs ? Math.round((o.price * o.latePenaltyPct) / 100) : 0;
}

/** IST calendar date and minutes-since-midnight for an instant. */
export function istNow(now: Date): { date: string; minutes: number } {
  const shifted = new Date(now.getTime() + SALON_UTC_OFFSET_MIN * 60_000);
  return { date: shifted.toISOString().slice(0, 10), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

/** The instant a booking starts, given its salon-local date and start minute. */
export function bookingStartMs(date: string, startMin: number): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 0, startMin) - SALON_UTC_OFFSET_MIN * 60_000;
}
