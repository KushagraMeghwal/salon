export type PeriodKey = 'day' | 'week' | 'month';

export interface ServiceRow {
  name: string;
  meta: string;
  volume: number;
  revenue: number;
}

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
  labels: string[];
  current: number[];
  previous: number[];
  payment: { upi: number; card: number; cash: number; voucher: number };
  services: ServiceRow[];
}

export const PERIODS: Record<PeriodKey, PeriodData> = {
  month: {
    key: 'month', label: 'Month', range: 'This month vs previous month', compare: 'Comparison vs. previous month',
    revenue: 542900, prevRevenue: 459200, footfall: 612, footfallDelta: 9.4, booked: 486, walkin: 126, avgTicket: 887, avgDelta: 8.1,
    retention: 72, retentionDelta: 4.2, returning: 441,
    labels: ['1', '4', '8', '12', '16', '20', '24'],
    current: [14200, 16800, 15400, 19800, 24500, 21900, 27800, 22400, 24100, 33200, 29800, 38450, 31200, 36890],
    previous: [12800, 13900, 14600, 15200, 17800, 16900, 20100, 19400, 18200, 24500, 26100, 28800, 27400, 30200],
    payment: { upi: 58, card: 24, cash: 15, voucher: 3 },
    services: [
      { name: 'Keratin Treatment', meta: 'Hair Care & Rejuvenation • 120 mins', volume: 42, revenue: 188000 },
      { name: 'Signature Fade', meta: 'Styling & Cut • 35 mins', volume: 234, revenue: 117000 },
      { name: 'Hydra Facial', meta: 'Skin Therapy & Glow • 60 mins', volume: 48, revenue: 94000 },
      { name: 'Beard Spa', meta: 'Grooming & Hot Towel • 45 mins', volume: 118, revenue: 69600 },
    ],
  },
  week: {
    key: 'week', label: 'Week', range: 'Last 7 days vs previous 7 days', compare: 'Comparison vs. previous 7 days',
    revenue: 148600, prevRevenue: 131200, footfall: 168, footfallDelta: 6.3, booked: 131, walkin: 37, avgTicket: 884, avgDelta: 5.4,
    retention: 70, retentionDelta: 2.1, returning: 118,
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    current: [16800, 15400, 18900, 20100, 24600, 29800, 23000],
    previous: [15100, 14200, 16800, 18400, 21700, 25200, 19800],
    payment: { upi: 61, card: 22, cash: 14, voucher: 3 },
    services: [
      { name: 'Keratin Treatment', meta: 'Hair Care & Rejuvenation • 120 mins', volume: 11, revenue: 49200 },
      { name: 'Signature Fade', meta: 'Styling & Cut • 35 mins', volume: 64, revenue: 32000 },
      { name: 'Hydra Facial', meta: 'Skin Therapy & Glow • 60 mins', volume: 13, revenue: 25400 },
      { name: 'Beard Spa', meta: 'Grooming & Hot Towel • 45 mins', volume: 33, revenue: 19400 },
    ],
  },
  day: {
    key: 'day', label: 'Day', range: 'Today vs yesterday', compare: 'Comparison vs. yesterday',
    revenue: 28450, prevRevenue: 24950, footfall: 38, footfallDelta: 11.8, booked: 22, walkin: 16, avgTicket: 749, avgDelta: 3.2,
    retention: 68, retentionDelta: 1.4, returning: 26,
    labels: ['9 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM', '9 PM'],
    current: [1800, 3400, 2600, 4800, 6200, 7400, 2250],
    previous: [1500, 2900, 2400, 4200, 5300, 6100, 2550],
    payment: { upi: 65, card: 18, cash: 15, voucher: 2 },
    services: [
      { name: 'Keratin Treatment', meta: 'Hair Care & Rejuvenation • 120 mins', volume: 2, revenue: 5600 },
      { name: 'Signature Fade', meta: 'Styling & Cut • 35 mins', volume: 12, revenue: 6000 },
      { name: 'Hydra Facial', meta: 'Skin Therapy & Glow • 60 mins', volume: 3, revenue: 4500 },
      { name: 'Beard Spa', meta: 'Grooming & Hot Towel • 45 mins', volume: 6, revenue: 3600 },
    ],
  },
};
