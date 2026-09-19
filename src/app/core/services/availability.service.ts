import { Injectable, inject } from '@angular/core';
import { slotStarts } from '@chairly/shared';
import { SalonStore } from './salon.store';
import { dateKey, toMin, LOCALE } from '../utils/time';

export interface SlotOption {
  start: number;
  staffIds: string[];
  period: 'morning' | 'afternoon' | 'evening';
}

export interface DayOption {
  key: string;
  date: Date;
  dow: string;
  day: number;
  month: string;
  weekend: boolean;
  closed: boolean;
}

/**
 * Client-side mirror of the `getAvailability` Cloud Function (Phase 4).
 * Same rules: salon timing, holidays, breaks, each stylist's working days and bookings.
 */
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly store = inject(SalonStore);

  totalDuration(serviceIds: string[]) {
    return serviceIds.reduce((a, id) => a + (this.store.serviceById(id)?.duration ?? 0), 0);
  }

  days(count = 14): DayOption[] {
    const out: DayOption[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const key = dateKey(d);
      out.push({
        key, date: d, dow: d.toLocaleDateString(LOCALE(), { weekday: 'short' }), day: d.getDate(),
        month: d.toLocaleDateString(LOCALE(), { month: 'short' }), weekend: d.getDay() === 0 || d.getDay() === 6,
        closed: !this.store.dayTiming(key).open,
      });
    }
    return out;
  }

  /** Bookable start times. `staffId` limits the search to one stylist. */
  slots(date: string, opts: { serviceIds?: string[]; duration?: number; staffId?: string | null; ignoreBookingId?: string; includeBusy?: boolean }): SlotOption[] {
    const t = this.store.dayTiming(date);
    if (!t.open) return [];
    const serviceIds = opts.serviceIds ?? [];
    const duration = opts.duration ?? this.totalDuration(serviceIds);
    if (duration <= 0) return [];
    const pool =
      opts.staffId && opts.staffId !== 'any'
        ? this.store.staff().filter((s) => s.id === opts.staffId)
        : this.store.eligibleStaff(date, serviceIds);
    if (!pool.length) return [];

    const open = toMin(t.start);
    const close = toMin(t.end);
    const step = Math.max(5, this.store.slotMode() === 'auto' ? duration + this.store.buffer() : this.store.customInterval());
    const isToday = date === dateKey(new Date());
    const earliest = isToday ? this.store.nowMin() + 30 : 0;

    const out: SlotOption[] = [];
    for (const start of slotStarts({ open, close, duration, step, earliest })) {
      const staffIds = pool.filter((s) => !this.store.checkBooking(date, s.id, start, duration, opts.ignoreBookingId)).map((s) => s.id);
      if (staffIds.length || opts.includeBusy) {
        out.push({ start, staffIds, period: start < 12 * 60 ? 'morning' : start < 17 * 60 ? 'afternoon' : 'evening' });
      }
    }
    return out;
  }

  /**
   * "Best time for you". With booking history it is the free slot closest to the hour the customer usually comes at
   * (median start of their past visits). New customers get the free slot with the most stylists available, i.e. the
   * quietest time, earliest first. Null when there is nothing to choose between.
   */
  bestSlot(slots: SlotOption[], pastStarts: number[]): { slot: SlotOption; pref: number | null; reason: string } | null {
    const open = slots.filter((s) => s.staffIds.length);
    if (open.length < 2) return null;
    const past = [...pastStarts].sort((a, b) => a - b);
    if (past.length) {
      const pref = past[Math.floor(past.length / 2)];
      const slot = [...open].sort((a, b) => Math.abs(a.start - pref) - Math.abs(b.start - pref) || b.staffIds.length - a.staffIds.length || a.start - b.start)[0];
      return { slot, pref, reason: 'You usually book around {{p1}}' };
    }
    const slot = [...open].sort((a, b) => b.staffIds.length - a.staffIds.length || a.start - b.start)[0];
    return { slot, pref: null, reason: 'Quietest time: the most stylists are free' };
  }

  /** Eligible stylists who are busy at `start`, with the next time they could take the booking. */
  busyStaff(date: string, serviceIds: string[], start: number, duration: number) {
    const close = toMin(this.store.dayTiming(date).end);
    return this.store
      .eligibleStaff(date, serviceIds)
      .filter((s) => this.store.checkBooking(date, s.id, start, duration))
      .map((s) => {
        let freeAt: number | null = null;
        for (let t = start + 5; t + duration <= close; t += 5) {
          if (!this.store.checkBooking(date, s.id, t, duration)) {
            freeAt = t;
            break;
          }
        }
        return { staffId: s.id, freeAt };
      });
  }
}
