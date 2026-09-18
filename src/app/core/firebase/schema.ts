import type { Timestamp } from 'firebase/firestore';
import type { BankAccount, DayTiming, Holiday, PayMethod, Role } from '../models';

/**
 * Firestore document shapes (Phase 3). Paths, ownership and who-can-write are enforced by
 * firestore.rules; see docs/data-model.md. `Timestamp` fields are server timestamps.
 */

// ---------- top level ----------
export interface FsUser {
  role: Role;
  salonIds: string[];
  name: string;
  phone: string;
  lang?: 'en' | 'hi';
  noShowCount: number; // total across salons, maintained by functions
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/** slugs/{slug} -> resolves the public link /s/:slug. Created only by functions (keeps slugs unique). */
export interface FsSlug {
  salonId: string;
}

export interface FsPlan {
  name: string;
  price: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

/** platform/stats -> superadmin overview, maintained by functions. */
export interface FsPlatformStats {
  salons: number;
  trials: number;
  subscribers: number;
  mrr: number;
  signupsByWeek: number[];
}

// ---------- salons/{salonId} (public, browsable) ----------
export type SalonStatus = 'draft' | 'active' | 'suspended';

export interface FsSalon {
  ownerId: string;
  status: SalonStatus; // function-managed (draft -> active on onboarding complete)
  bookable: boolean; // function-managed: status active AND subscription valid
  slug: string; // function-managed
  logoUrl?: string | null;
  profile: {
    name: string;
    category: string;
    phone: string;
    email: string;
    street: string;
    landmark: string;
    city: string;
    pin: string;
    state: string;
    lat: number;
    lng: number;
  };
  timings: DayTiming[]; // Monday..Sunday
  breaks: { enabled: boolean; start: string; end: string; blockSlots: boolean };
  holidays: Holiday[];
  slotMode: 'auto' | 'custom';
  customSlots: number[]; // interval options in minutes
  buffer: number;
  settings: {
    allowPayAtSalon: boolean;
    requireOnlineAfterNoShows: boolean;
    noShowThreshold: number; // spec default 2
    cancelWindowHrs: number;
    latePenaltyPct: number;
    hindiSupport: boolean;
    instantPayout: boolean;
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// salons/{id}/services/{serviceId}
export interface FsService {
  name: string;
  category: string;
  description: string;
  price: number;
  duration: number; // minutes
  active: boolean;
  custom?: boolean;
  sortOrder?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// salons/{id}/staff/{staffId}: public stylist card
export interface FsStaff {
  name: string;
  role: string;
  title: string;
  serviceIds: string[];
  days: boolean[]; // Monday..Sunday
  photoUrl: string | null;
  active: boolean;
  order?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// salons/{id}/staffPrivate/{staffId}: owner and that stylist only
export interface FsStaffPrivate {
  phone: string;
  email: string;
  commission: number; // percent 0-100
  updatedAt?: Timestamp;
}

// salons/{id}/staffStats/{staffId}: function-maintained
export interface FsStaffStats {
  clients: number;
  revenue: number;
  commission: number;
  tips: number;
  rating: number;
  reviews: number;
  month: string; // YYYY-MM
  weekRevenue: number[]; // Monday..Sunday
}

// salons/{id}/stats/{daily_YYYYMMDD | week_YYYYWW | month_YYYYMM}: function-maintained earnings aggregates
export interface FsPeriodStats {
  period: 'day' | 'week' | 'month';
  key: string;
  revenue: number;
  bills: number;
  bookings: number;
  walkIns: number;
  online: number;
  byMethod: Partial<Record<PayMethod, number>>;
  updatedAt: Timestamp;
}

// salons/{id}/private/payout: owner-editable, masked display only (real details live with the payment provider)
export type FsPayout = BankAccount & { providerAccountId?: string };

// salons/{id}/private/billing: functions/superadmin only
export interface FsBilling {
  plan: string;
  status: 'trial' | 'active' | 'suspended' | 'expired';
  trialEndsAt: Timestamp;
  renewsAt?: Timestamp;
}

// ---------- bookings & billing (written only by functions) ----------
export type FsBookingStatus = 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';

export interface FsBooking {
  bookingNo: string;
  customerId: string | null; // null for walk-ins created by the owner
  customerName: string;
  customerPhone: string;
  staffId: string;
  date: string; // YYYY-MM-DD (salon local)
  start: number; // minutes from midnight
  end: number;
  duration: number;
  services: { serviceId: string; name: string; price: number; duration: number }[];
  price: number;
  status: FsBookingStatus;
  vip?: boolean;
  notes?: string;
  tip?: number;
  source: 'online' | 'owner' | 'walk-in';
  payment: {
    mode: 'online' | 'salon';
    status: 'pending' | 'paid' | 'refunded' | 'failed';
    provider?: 'razorpay';
    orderId?: string;
    paymentId?: string;
  };
  cancelledAt?: Timestamp;
  cancelFee?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FsBill {
  invoiceNo: string; // e.g. CH/26-27/00042 (GST-ready sequence per financial year)
  date: string;
  bookingId?: string;
  customerName: string;
  customerPhone: string;
  lines: { serviceId: string; name: string; price: number; qty: number; staffId: string }[];
  subtotal: number;
  cgst: number;
  sgst: number;
  discount: number;
  total: number;
  method: PayMethod;
  createdAt: Timestamp;
}

// salons/{id}/customers/{uid}
export interface FsCustomer {
  name: string;
  phone: string;
  noShowCount: number; // per-salon, drives requireOnlineAfterNoShows
  visits: number;
  totalSpent: number;
  lastVisit?: string;
}

/** salons/{id}/staffDays/{staffId_YYYY-MM-DD}: locks used inside the booking transaction. */
export interface FsStaffDay {
  busy: { bookingId: string; start: number; end: number }[];
}

/** Custom claims carried on the Auth token (rules read these; only functions can set them). */
export interface AuthClaims {
  role: Role;
  salonIds: string[];
  staffId?: string;
}

// ---------- paths ----------
export const FS = {
  user: (uid: string) => `users/${uid}`,
  slug: (slug: string) => `slugs/${slug}`,
  plan: (id: string) => `plans/${id}`,
  salon: (id: string) => `salons/${id}`,
  services: (id: string) => `salons/${id}/services`,
  staff: (id: string) => `salons/${id}/staff`,
  staffPrivate: (id: string, staffId: string) => `salons/${id}/staffPrivate/${staffId}`,
  staffStats: (id: string, staffId: string) => `salons/${id}/staffStats/${staffId}`,
  bookings: (id: string) => `salons/${id}/bookings`,
  bills: (id: string) => `salons/${id}/bills`,
  customer: (id: string, uid: string) => `salons/${id}/customers/${uid}`,
  stats: (id: string, key: string) => `salons/${id}/stats/${key}`,
  payout: (id: string) => `salons/${id}/private/payout`,
  billing: (id: string) => `salons/${id}/private/billing`,
  staffDay: (id: string, staffId: string, date: string) => `salons/${id}/staffDays/${staffId}_${date}`,
} as const;
