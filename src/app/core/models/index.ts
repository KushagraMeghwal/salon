export type Role = 'customer' | 'staff' | 'owner' | 'superadmin';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface DayTiming {
  open: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface SalonProfile {
  name: string;
  category: 'Unisex' | "Men's Salon" | 'Hair Studio' | 'Luxury Spa';
  phone: string;
  email: string;
  street: string;
  landmark: string;
  city: string;
  pin: string;
  state: string;
  lat: number;
  lng: number;
  logo: string | null;
  slug: string;
}

export interface BreakSettings {
  enabled: boolean;
  start: string;
  end: string;
  blockSlots: boolean;
}

export interface CatalogService {
  id: string;
  name: string;
  category: string;
  description: string;
  suggestedPrice: number;
  suggestedDuration: number;
  durationOptions: number[];
  selected: boolean;
  price: number;
  duration: number;
  custom?: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  title: string;
  phone: string;
  email: string;
  serviceIds: string[];
  days: boolean[]; // Mon..Sun
  commission: number;
  photo: string | null;
  status: 'on-duty' | 'off';
}

export type BookingStatus = 'confirmed' | 'in-progress' | 'completed' | 'vip' | 'cancelled';

export interface Booking {
  id: string;
  date: string; // YYYY-MM-DD
  staffId: string;
  client: string;
  phone: string;
  serviceName: string;
  start: number; // minutes from midnight
  duration: number;
  price: number;
  status: BookingStatus;
  notes?: string;
  /** Line items when several services are booked together. */
  services?: { name: string; price: number; duration: number }[];
  payment?: 'online' | 'salon';
  paid?: boolean;
  bookingNo?: string;
  customerPhone?: string;
  tip?: number;
  vip?: boolean;
  source?: 'online' | 'owner';
}

export type QueueStage = 'waiting' | 'in-chair' | 'done';
export type PayMethod = 'Cash' | 'UPI' | 'Card' | 'Split';

export interface QueueItem {
  id: string;
  stage: QueueStage;
  client: string;
  phone: string;
  service: string;
  category: string;
  price: number;
  duration: number;
  requestedStaffId: string | null;
  staffId: string | null;
  station: number | null;
  source: 'walkin' | 'app';
  arrivedAt: number; // minute of day
  startedAt: number | null;
  billNo?: string;
  payMethod?: PayMethod;
  billedAt?: string;
}

export interface BillLine {
  serviceId: string;
  name: string;
  price: number;
  qty: number;
  staffId: string;
}

export interface Bill {
  no: string;
  client: string;
  phone: string;
  lines: BillLine[];
  subtotal: number;
  gst: number;
  loyaltyDiscount: number;
  total: number;
  method: PayMethod;
  createdAt: string;
}

export interface StaffStats {
  staffId: string;
  clients: number;
  workDays: number;
  revenue: number;
  prevRevenue: number;
  rating: number;
  reviews: number;
  tips: number;
  week: number[]; // 7 daily revenue values (Mon..Sun)
}

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'expired';

export interface AdminSalon {
  id: string;
  name: string;
  owner: string;
  city: string;
  plan: 'Trial' | 'Starter' | 'Growth' | 'Pro';
  trialEndsAt: string; // ISO date
  status: SubscriptionStatus;
  joinedAt: string;
  staff: number;
  mrr: number;
}

export interface Plan {
  id: 'starter' | 'growth' | 'pro';
  name: string;
  price: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'full' | 'half';
  closeAt?: string; // HH:mm, for half days
}

export interface BankAccount {
  bankName: string;
  accountLast4: string;
  ifsc: string;
  beneficiary: string;
}

export interface SalonSettings {
  allowPayAtSalon: boolean;
  requireOnlineAfterNoShows: boolean;
  noShowThreshold: number;
  cancelWindowHrs: number;
  latePenaltyPct: number;
  hindiSupport: boolean;
  holidays: Holiday[];
  instantPayout: boolean;
  bank: BankAccount | null;
  plan: string;
  trialEndsAt: string; // ISO date
}

export interface CustomerSession {
  phone: string;
  name: string;
  noShowCount: number;
}
