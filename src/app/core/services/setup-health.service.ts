import { Injectable, computed, inject } from '@angular/core';
import { SalonStore } from './salon.store';
import { toMin } from '../utils/time';

export interface HealthIssue {
  id: string;
  /** error: customers cannot book (or part of the salon cannot be booked). warning: works, but likely not what the owner wants. */
  level: 'error' | 'warning';
  title: string;
  detail: string;
  link: string;
  action: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Finds owner setup gaps that make the customer booking page show "No slots" (or nothing at all).
 * Mirrors the rules in AvailabilityService/SalonStore.eligibleStaff, so every issue listed here is one the customer would hit.
 */
@Injectable({ providedIn: 'root' })
export class SetupHealthService {
  private readonly store = inject(SalonStore);

  readonly issues = computed<HealthIssue[]>(() => {
    const s = this.store;
    if (s.mode() !== 'owner') return [];
    const out: HealthIssue[] = [];
    const staff = s.staff();
    const services = s.selectedServices();
    const timings = s.timings();
    const openDays = timings.map((t) => t.open);

    if (!s.bookable()) {
      out.push({ id: 'not-bookable', level: 'error', title: 'Online booking is off', detail: 'Customers see "not taking online bookings". Finish setup (services, timings and at least one stylist) to switch it on.', link: '/owner/settings', action: 'Open settings' });
    }
    if (!openDays.some(Boolean)) {
      out.push({ id: 'all-closed', level: 'error', title: 'Salon is closed every day', detail: 'No weekday is marked open, so no date can be booked.', link: '/owner/settings;tab=hours', action: 'Set working hours' });
    }
    if (!services.length) {
      out.push({ id: 'no-services', level: 'error', title: 'No services are switched on', detail: 'Customers have nothing to pick on the services page.', link: '/owner/profile;tab=services', action: 'Add services' });
    }
    if (!staff.length) {
      out.push({ id: 'no-staff', level: 'error', title: 'No stylists added', detail: 'Every date shows "No slots" until at least one stylist is added.', link: '/owner/staff', action: 'Add a stylist' });
    }

    // A stylist who is missing services or works only on days the salon is closed can never be booked.
    // Link straight to that stylist's editor (matrix param) so "Edit stylist" opens them pre-filled, not just the roster list.
    for (const m of staff) {
      if (!m.serviceIds.length) {
        out.push({ id: 'staff-no-services:' + m.id, level: 'error', title: `${m.name} has no services`, detail: 'Tick the services they perform, or customers can never pick them.', link: `/owner/staff;edit=${m.id}`, action: 'Edit stylist' });
      } else if (!m.days.some((d, i) => d && openDays[i])) {
        const why = m.days.some(Boolean) ? 'only works on days the salon is closed' : 'has no working days';
        out.push({ id: 'staff-no-days:' + m.id, level: 'error', title: `${m.name} is never available`, detail: `${m.name} ${why}.`, link: `/owner/staff;edit=${m.id}`, action: 'Edit stylist' });
      }
    }

    // Services no bookable stylist offers: this is the exact cause of "No single stylist offers all the selected services".
    if (staff.length) {
      const bookable = staff.filter((m) => m.days.some((d, i) => d && openDays[i]));
      const orphan = services.filter((sv) => !bookable.some((m) => m.serviceIds.includes(sv.id)));
      if (orphan.length) {
        const names = orphan.slice(0, 4).map((x) => x.name).join(', ') + (orphan.length > 4 ? ` and ${orphan.length - 4} more` : '');
        out.push({ id: 'orphan-services', level: 'error', title: `${orphan.length} service${orphan.length > 1 ? 's' : ''} no stylist offers`, detail: `${names}. Customers who pick ${orphan.length > 1 ? 'these' : 'this'} see "No slots" on every date. Assign ${orphan.length > 1 ? 'them' : 'it'} to a stylist.`, link: '/owner/staff', action: 'Assign to a stylist' });
      }
    }

    // A service longer than the longest opening window can never fit in a day.
    const longest = Math.max(0, ...timings.filter((t) => t.open).map((t) => toMin(t.end) - toMin(t.start)));
    if (longest > 0) {
      const tooLong = services.filter((sv) => sv.duration > longest);
      if (tooLong.length) {
        out.push({ id: 'too-long', level: 'error', title: `${tooLong[0].name} is longer than your opening hours`, detail: `It takes ${tooLong[0].duration} min but the longest day is ${longest} min, so it can never be booked.`, link: '/owner/profile;tab=services', action: 'Fix duration or hours' });
      }
    }

    // Days the salon is open but nobody works.
    if (staff.length) {
      const uncovered = timings.map((t, i) => (t.open && !staff.some((m) => m.days[i]) ? DAYS[i] : '')).filter(Boolean);
      if (uncovered.length) {
        out.push({ id: 'uncovered-days', level: 'warning', title: `No stylist works on ${uncovered.join(', ')}`, detail: 'The salon is open those days but customers see "No slots".', link: '/owner/staff', action: 'Set working days' });
      }
    }

    if (s.settings().latePenaltyPct > 0 && s.settings().cancelWindowHrs <= 0) {
      out.push({ id: 'penalty-window', level: 'warning', title: 'Late-cancellation fee will never apply', detail: 'A penalty is set but the cancellation window is 0 hours.', link: '/owner/settings;tab=policies', action: 'Open settings' });
    }

    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
  });

  readonly errorCount = computed(() => this.issues().filter((i) => i.level === 'error').length);
}
