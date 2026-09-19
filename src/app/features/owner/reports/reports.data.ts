export type PeriodKey = 'day' | 'week' | 'month';

export interface ServiceRow {
  name: string;
  meta: string;
  volume: number;
  revenue: number;
}

/** One report period, computed from the salon's real bills and bookings (see AnalyticsService). */
export interface PeriodData {
  key: PeriodKey;
  label: string;
  range: string;
  compare: string;
  revenue: number;
  prevRevenue: number;
  footfall: number;
  footfallDelta: number;
  booked: number;
  walkin: number;
  avgTicket: number;
  avgDelta: number;
  retention: number;
  retentionDelta: number;
  returning: number;
  /** Axis labels under the chart. */
  labels: string[];
  /** One label per plotted point (tooltip). */
  pointLabels: string[];
  current: number[];
  previous: number[];
  /** Share of revenue in percent; `voucher` holds "other" (online prepay, split, unknown). */
  payment: { upi: number; card: number; cash: number; voucher: number };
  services: ServiceRow[];
}

export const PERIOD_KEYS: { key: PeriodKey; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];
