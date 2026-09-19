import { Injectable, computed, inject } from '@angular/core';
import { addDays, customerKey } from '@chairly/shared';
import { PeriodData, PeriodKey } from '../../features/owner/reports/reports.data';
import { StaffStats } from '../models';
import { dateKey } from '../utils/time';
import { SalonStore } from './salon.store';

/** One paid visit. Built from bills and completed bookings, so revenue is counted exactly once. */
export interface RevEvent {
  date: string;
  /** Minute of day the visit happened (booking start, or the time the bill was issued). */
  minute: number;
  amount: number;
  method: 'UPI' | 'Card' | 'Cash' | 'Other';
  source: 'booked' | 'walkin';
  clientKey: string;
  shares: { staffId: string | null; amount: number }[];
  lines: { name: string; qty: number; amount: number }[];
}

const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur ? 100 : 0);
const sum = (l: number[]) => l.reduce((a, b) => a + b, 0);

/**
 * Dashboard, report and stylist numbers computed from the salon's real bills and bookings (owner and stylist modes).
 * This is a client-side rollup over the last ~70 days that the store keeps live; if a salon outgrows that, move it to
 * per-day aggregate documents maintained by a Cloud Function (data model already reserves `stats/`).
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly store = inject(SalonStore);

  /** Local date of "today", refreshed with the store's minute clock. */
  private readonly today = computed(() => {
    this.store.nowMin();
    return dateKey(new Date());
  });

  readonly events = computed<RevEvent[]>(() => {
    const bills = this.store.bills();
    const billFor = new Map(bills.filter((b) => b.bookingId).map((b) => [b.bookingId!, b]));
    const out: RevEvent[] = [];
    for (const b of this.store.bookings()) {
      if (b.status !== 'completed') continue;
      const bill = billFor.get(b.id);
      const amount = bill?.total ?? b.price;
      const scale = b.price ? amount / b.price : 1;
      const lines = (b.services?.length ? b.services : [{ name: b.serviceName, price: b.price, duration: b.duration }]).map((s) => ({ name: s.name, qty: 1, amount: s.price * scale }));
      out.push({
        date: b.date, minute: b.start, amount, method: bill ? this.method(bill.method) : 'Other', source: 'booked',
        clientKey: customerKey(b.customerPhone ?? b.phone, b.client), shares: [{ staffId: b.staffId, amount }], lines,
      });
    }
    for (const bill of bills) {
      if (bill.bookingId) continue; // already counted through its booking
      const at = new Date(bill.createdAt);
      const scale = bill.subtotal ? bill.total / bill.subtotal : 1;
      const byStaff = new Map<string | null, number>();
      for (const l of bill.lines) byStaff.set(l.staffId || null, (byStaff.get(l.staffId || null) ?? 0) + l.price * l.qty * scale);
      out.push({
        date: bill.date ?? dateKey(at), minute: at.getHours() * 60 + at.getMinutes(), amount: bill.total, method: this.method(bill.method), source: 'walkin',
        clientKey: customerKey(bill.phone, bill.client), shares: [...byStaff].map(([staffId, amount]) => ({ staffId, amount })),
        lines: bill.lines.map((l) => ({ name: l.name, qty: l.qty, amount: l.price * l.qty * scale })),
      });
    }
    return out;
  });

  private method(m: string): RevEvent['method'] {
    return m === 'UPI' || m === 'Card' || m === 'Cash' ? m : 'Other';
  }

  private between(from: string, to: string) {
    return this.events().filter((e) => e.date >= from && e.date <= to);
  }

  // ---------- dashboard (today) ----------
  readonly todayStats = computed(() => {
    const t = this.today();
    const ev = this.events().filter((e) => e.date === t);
    const open = this.store.bookingsFor(t).filter((b) => b.status !== 'held' && b.status !== 'no-show');
    const q = this.store.queue();
    const done = ev.length;
    return {
      earnings: Math.round(sum(ev.map((e) => e.amount))),
      done,
      // Appointments plus everyone who walked in today (billed walk-ins sit in the queue as "done").
      total: Math.max(open.length + q.length, done),
      walkins: q.filter((x) => x.source === 'walkin').length + open.filter((b) => b.source === 'owner').length,
      online: q.filter((x) => x.source === 'app').length + open.filter((b) => b.source === 'online').length,
      upi: Math.round(sum(ev.filter((e) => e.method === 'UPI').map((e) => e.amount))),
    };
  });

  /** Busiest hours over the last 30 days, from booking start times. */
  readonly rush = computed(() => {
    const from = addDays(this.today(), -30);
    const slots = [{ label: '9 AM', from: 9, to: 11 }, { label: '11 AM', from: 11, to: 13 }, { label: '1 PM', from: 13, to: 15 }, { label: '3 PM', from: 15, to: 18 }, { label: '6 PM', from: 18, to: 20 }, { label: '8 PM', from: 20, to: 24 }];
    const list = this.store.bookings().filter((b) => b.date >= from && b.status !== 'cancelled' && b.status !== 'expired');
    return slots.map((s) => ({ ...s, value: list.filter((b) => b.start / 60 >= s.from && b.start / 60 < s.to).length }));
  });

  // ---------- staff ----------
  readonly staffStats = computed<StaffStats[]>(() => {
    const t = this.today();
    const monthStart = t.slice(0, 8) + '01';
    const prevMonthStart = dateKey(new Date(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 2, 1));
    const prevMonthEnd = addDays(monthStart, -1);
    const dow = (new Date(t + 'T00:00').getDay() + 6) % 7;
    const weekStart = addDays(t, -dow);
    return this.store.staffAll().map((s) => {
      const mine = (from: string, to: string) =>
        this.between(from, to).flatMap((e) => e.shares.filter((x) => x.staffId === s.id).map((x) => ({ date: e.date, amount: x.amount })));
      const cur = mine(monthStart, t);
      const week = Array.from({ length: 7 }, (_, i) => Math.round(sum(mine(addDays(weekStart, i), addDays(weekStart, i)).map((x) => x.amount))));
      return {
        staffId: s.id, clients: cur.length, workDays: new Set(cur.map((x) => x.date)).size, revenue: Math.round(sum(cur.map((x) => x.amount))),
        prevRevenue: Math.round(sum(mine(prevMonthStart, prevMonthEnd).map((x) => x.amount))), week,
      };
    });
  });

  /** A stylist's completed work between two dates (their own earnings screen). */
  staffEarnings(staffId: string, from: string, to: string) {
    const rows = this.between(from, to).flatMap((e) => e.shares.filter((x) => x.staffId === staffId).map((x) => ({ date: e.date, amount: x.amount })));
    return { revenue: Math.round(sum(rows.map((r) => r.amount))), clients: rows.length };
  }

  // ---------- reports ----------
  readonly periods = computed<Record<PeriodKey, PeriodData>>(() => ({ day: this.build('day'), week: this.build('week'), month: this.build('month') }));

  private build(key: PeriodKey): PeriodData {
    const t = this.today();
    const cfg =
      key === 'day'
        ? { span: 1, buckets: 7, label: 'Day', range: 'Today vs yesterday', compare: 'Comparison vs. yesterday' }
        : key === 'week'
          ? { span: 7, buckets: 7, label: 'Week', range: 'Last 7 days vs previous 7 days', compare: 'Comparison vs. previous 7 days' }
          : { span: 30, buckets: 15, label: 'Month', range: 'Last 30 days vs previous 30 days', compare: 'Comparison vs. previous 30 days' };
    const curFrom = addDays(t, -(cfg.span - 1));
    const prevTo = addDays(curFrom, -1);
    const prevFrom = addDays(prevTo, -(cfg.span - 1));
    const cur = this.between(curFrom, t);
    const prev = this.between(prevFrom, prevTo);

    const bucket = (e: RevEvent, from: string) => {
      if (key === 'day') return Math.min(6, Math.max(0, Math.floor((e.minute / 60 - 9) / 2)));
      const off = Math.round((Date.parse(e.date) - Date.parse(from)) / 86400000);
      return Math.min(cfg.buckets - 1, Math.floor(off / (cfg.span / cfg.buckets)));
    };
    const series = (list: RevEvent[], from: string) => {
      const out = Array<number>(cfg.buckets).fill(0);
      for (const e of list) out[bucket(e, from)] += e.amount;
      return out.map(Math.round);
    };

    const revenue = Math.round(sum(cur.map((e) => e.amount)));
    const prevRevenue = Math.round(sum(prev.map((e) => e.amount)));
    const avg = (l: RevEvent[]) => (l.length ? sum(l.map((e) => e.amount)) / l.length : 0);
    const visits = new Map(this.store.customers().map((c) => [c.id, c.visits]));
    const retention = (l: RevEvent[]) => {
      const clients = [...new Set(l.map((e) => e.clientKey))];
      const returning = clients.filter((c) => (visits.get(c) ?? 0) >= 2).length;
      return { returning, pct: clients.length ? Math.round((returning / clients.length) * 100) : 0 };
    };
    const rc = retention(cur);
    const rp = retention(prev);

    const byMethod = (m: RevEvent['method']) => (revenue ? Math.round((sum(cur.filter((e) => e.method === m).map((e) => e.amount)) / revenue) * 100) : 0);
    const upi = byMethod('UPI');
    const card = byMethod('Card');
    const cash = byMethod('Cash');

    const svc = new Map<string, { volume: number; revenue: number }>();
    for (const e of cur) for (const l of e.lines) svc.set(l.name, { volume: (svc.get(l.name)?.volume ?? 0) + l.qty, revenue: (svc.get(l.name)?.revenue ?? 0) + l.amount });
    const services = [...svc].map(([name, v]) => {
      const s = this.store.services().find((x) => x.name === name);
      return { name, meta: s ? `${s.category} • ${s.duration} mins` : 'Custom service', volume: v.volume, revenue: Math.round(v.revenue) };
    });

    const short = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const pointLabels =
      key === 'day'
        ? ['9 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM', '9 PM']
        : Array.from({ length: cfg.buckets }, (_, i) => {
            const d = addDays(curFrom, Math.floor((i * cfg.span) / cfg.buckets));
            return key === 'week' ? new Date(d + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short' }) : short(d);
          });
    const labels = key === 'month' ? [0, 2, 4, 7, 10, 12, 14].map((i) => pointLabels[i]) : pointLabels;

    return {
      key, label: cfg.label, range: cfg.range, compare: cfg.compare, revenue, prevRevenue,
      footfall: cur.length, footfallDelta: pct(cur.length, prev.length), booked: cur.filter((e) => e.source === 'booked').length, walkin: cur.filter((e) => e.source === 'walkin').length,
      avgTicket: Math.round(avg(cur)), avgDelta: pct(avg(cur), avg(prev)), retention: rc.pct, retentionDelta: Math.round((rc.pct - rp.pct) * 10) / 10, returning: rc.returning,
      labels, pointLabels, current: series(cur, curFrom), previous: series(prev, prevFrom),
      payment: { upi, card, cash, voucher: revenue ? Math.max(0, 100 - upi - card - cash) : 0 }, services,
    };
  }
}
