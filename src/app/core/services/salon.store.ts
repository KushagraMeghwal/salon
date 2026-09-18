import { Injectable, computed, effect, signal } from '@angular/core';
import {
  Bill, BillLine, Booking, Holiday, BreakSettings, CatalogService, DayTiming, PayMethod,
  CustomerRecord, QueueItem, SalonProfile, SalonSettings, StaffMember, StaffStats,
} from '../models';
import { cancellationFee, checkSalonRules, customerKey, clampDiscount, effectiveTiming, overlaps, phoneKey, splitGst, weekdayIndex } from '@chairly/shared';
import { dateKey, slugify, toMin } from '../utils/time';

const STORAGE_KEY = 'chairly.salon.v1';

const SEED_PROFILE: SalonProfile = {
  name: 'Luxe Grooming Studio & Spa',
  category: 'Unisex',
  phone: '98234 56789',
  email: 'owner@studio.com',
  street: 'Shop 14-16, Ground Floor, The Grand Pavilion',
  landmark: 'Opposite Central City Mall, Indiranagar',
  city: 'Bengaluru',
  pin: '560038',
  state: 'KA',
  lat: 12.9716,
  lng: 77.6412,
  logo: null,
  slug: 'luxe-grooming-studio-and-spa',
};

const svc = (
  id: string, name: string, category: string, description: string,
  suggestedPrice: number, suggestedDuration: number, durationOptions: number[], selected = false,
): CatalogService => ({
  id, name, category, description, suggestedPrice, suggestedDuration, durationOptions,
  selected, price: suggestedPrice, duration: suggestedDuration,
});

const SEED_SERVICES: CatalogService[] = [
  svc('s1', 'Signature Haircut & Styling', 'Hair', 'Consultation, luxury hair wash, bespoke precision cut, and salon blowdry styling.', 450, 45, [30, 45, 60], true),
  svc('s2', 'Beard Trim & Shape', 'Beard & Shave', 'Precision edge styling, trimming, softening beard butter, and warm towel freshener.', 250, 25, [15, 25, 30], true),
  svc('s3', 'Keratin Hair Treatment', 'Hair', 'Intense anti-frizz formula smoothing protein treatment for long-lasting silky shine.', 2800, 90, [90, 120], true),
  svc('s4', 'Hydra-Glow Facial', 'Facial & Skin', 'Deep cellular hydration, botanical scrub exfoliation, and brightening LED therapy mask.', 1500, 60, [45, 60, 75], true),
  svc('s5', 'Head Massage & Aromatherapy', 'Spa & Massage', 'Stimulating herbal oil massage focusing on temples, neck pressure points, and shoulder relief.', 600, 30, [20, 30, 45], true),
  svc('s6', 'Classic Charcoal Detan', 'Facial & Skin', 'Active charcoal peel to remove stubborn sun-tan, dirt, and pollution impurities.', 350, 20, [20, 30]),
  svc('s7', 'Beard Spa & Hot Towel', 'Beard & Shave', 'Deep conditioning treatment with essential oils and dual steam towel wraps.', 400, 30, [30, 45]),
  svc('s8', 'Hair Root Touchup', 'Coloring', 'Ammonia-free targeted grey coverage blend along the natural hairline and parting.', 950, 45, [30, 45, 60]),
];


const SEED_STAFF: StaffMember[] = [
  { id: 'st1', name: 'Vikram Singh', role: 'Master Barber', title: 'Master Hair Director', phone: '+91 98201 44521', email: 'vikram.s@studio.com', serviceIds: ['s1', 's2', 's7'], days: [true, true, true, true, true, true, false], commission: 15, photo: null, status: 'on-duty' },
  { id: 'st2', name: 'Aarav Sharma', role: 'Senior Stylist', title: 'Color & Balayage Lead', phone: '+91 98765 43210', email: 'aarav.s@studio.com', serviceIds: ['s1', 's2', 's3', 's8'], days: [true, true, true, true, true, true, false], commission: 15, photo: null, status: 'on-duty' },
  { id: 'st3', name: 'Priya Patel', role: 'Colorist & Spa', title: 'Skin & Bridal Hair', phone: '+91 98234 56789', email: 'priya.p@studio.com', serviceIds: ['s4', 's5', 's6'], days: [false, false, true, true, true, true, true], commission: 12, photo: null, status: 'on-duty' },
  { id: 'st4', name: 'Sneha Rao', role: 'Nail & Skincare', title: 'Texture & Keratin Expert', phone: '+91 97120 54109', email: 'sneha.r@studio.com', serviceIds: ['s3', 's4', 's5'], days: [true, true, true, true, true, false, false], commission: 12, photo: null, status: 'on-duty' },
];

const SEED_STATS: StaffStats[] = [
  { staffId: 'st1', clients: 142, workDays: 24, revenue: 142800, prevRevenue: 121000, week: [21000, 18500, 23000, 27500, 24800, 31200, 26400] },
  { staffId: 'st2', clients: 118, workDays: 22, revenue: 118500, prevRevenue: 105800, week: [17200, 15800, 19400, 20100, 21600, 26800, 22300] },
  { staffId: 'st3', clients: 96, workDays: 20, revenue: 98400, prevRevenue: 92800, week: [0, 0, 14800, 17900, 18400, 22200, 19700] },
  { staffId: 'st4', clients: 88, workDays: 18, revenue: 84200, prevRevenue: 84200, week: [13400, 12100, 15200, 14800, 13900, 0, 0] },
];

const SEED_TIMINGS: DayTiming[] = [
  { open: true, start: '09:00', end: '21:00' },
  { open: true, start: '09:00', end: '21:00' },
  { open: true, start: '09:00', end: '21:00' },
  { open: true, start: '09:00', end: '21:00' },
  { open: true, start: '09:00', end: '22:00' },
  { open: true, start: '08:30', end: '22:00' },
  { open: true, start: '08:30', end: '22:00' },
];

const SEED_BREAK: BreakSettings = { enabled: true, start: '13:00', end: '14:00', blockSlots: true };

const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

const SEED_SETTINGS: SalonSettings = {
  allowPayAtSalon: true,
  requireOnlineAfterNoShows: true,
  noShowThreshold: 2,
  cancelWindowHrs: 2,
  latePenaltyPct: 15,
  hindiSupport: true,
  holidays: [
    { id: 'h1', date: plusDays(20), name: 'Diwali Festival (Deepavali)', type: 'full' },
    { id: 'h2', date: plusDays(35), name: 'Guru Nanak Jayanti', type: 'full' },
    { id: 'h3', date: plusDays(60), name: 'Christmas Day', type: 'half', closeAt: '13:00' },
  ],
  gstRegistered: false,
  gstin: '',
  bank: { bankName: 'HDFC Commercial Bank', accountLast4: '4912', ifsc: 'HDFC0000240', beneficiary: 'Luxe Grooming LLP' },
  plan: 'Chairly Pro',
  trialEndsAt: plusDays(14),
};

const COUPONS: Record<string, { type: 'percent' | 'flat'; value: number; label: string }> = {
  WELCOME10: { type: 'percent', value: 10, label: '10% off' },
  FLAT100: { type: 'flat', value: 100, label: '₹100 off' },
};

const SEED_CUSTOMERS: CustomerRecord[] = [
  { id: 'p_9876543210', name: 'Ananya Roy', phone: '+91 98765 43210', visits: 6, totalSpent: 7250, lastVisit: plusDays(-6), noShowCount: 0 },
  { id: 'p_9820144521', name: 'Rohan Kapoor', phone: '+91 98201 44521', visits: 11, totalSpent: 14980, lastVisit: plusDays(-2), noShowCount: 0 },
  { id: 'p_9765211984', name: 'Kavita Deshmukh', phone: '+91 97652 11984', visits: 9, totalSpent: 32400, lastVisit: plusDays(-9), noShowCount: 1 },
  { id: 'p_9900122334', name: 'Tanya Varma', phone: '+91 99001 22334', visits: 4, totalSpent: 5900, lastVisit: plusDays(-14), noShowCount: 0 },
  { id: 'p_9871033410', name: 'Simran Kaur', phone: '+91 98710 33410', visits: 7, totalSpent: 21300, lastVisit: plusDays(-4), noShowCount: 0 },
  { id: 'p_9833011223', name: 'Gaurav Sethi', phone: '+91 98330 11223', visits: 3, totalSpent: 3300, lastVisit: plusDays(-31), noShowCount: 2 },
  { id: 'p_9988211094', name: 'Zayn Merchant', phone: '+91 99882 11094', visits: 5, totalSpent: 9400, lastVisit: plusDays(-11), noShowCount: 0 },
  { id: 'p_9845077332', name: 'Pooja Nambiar', phone: '+91 98450 77332', visits: 8, totalSpent: 18650, lastVisit: plusDays(-1), noShowCount: 0 },
  { id: 'p_9712054109', name: 'Meera Sen', phone: '+91 97120 54109', visits: 2, totalSpent: 7600, lastVisit: plusDays(-45), noShowCount: 3 },
  { id: 'p_9811122334', name: 'Devraj Roy', phone: '+91 98111 22334', visits: 12, totalSpent: 11400, lastVisit: plusDays(-3), noShowCount: 0 },
];

export interface FreeSlot { staffId: string; start: number; end: number }

@Injectable({ providedIn: 'root' })
export class SalonStore {
  readonly profile = signal<SalonProfile>({ ...SEED_PROFILE });
  readonly services = signal<CatalogService[]>(structuredClone(SEED_SERVICES));
  readonly timings = signal<DayTiming[]>(structuredClone(SEED_TIMINGS));
  readonly brk = signal<BreakSettings>({ ...SEED_BREAK });
  readonly settings = signal<SalonSettings>(structuredClone(SEED_SETTINGS));
  readonly slotMode = signal<'auto' | 'custom'>('auto');
  readonly buffer = signal(10);
  readonly customIntervals = signal<number[]>([30, 45, 60]);
  readonly customInterval = signal(30);
  readonly staff = signal<StaffMember[]>(structuredClone(SEED_STAFF));
  readonly stats = signal<StaffStats[]>(structuredClone(SEED_STATS));
  readonly bookings = signal<Booking[]>([]);
  readonly queue = signal<QueueItem[]>([]);
  readonly bills = signal<Bill[]>([]);
  readonly customers = signal<CustomerRecord[]>(structuredClone(SEED_CUSTOMERS));
  readonly onboarded = signal(false);
  readonly lastSaved = signal<Date | null>(null);
  readonly nowMin = signal(this.currentMinute());
  private invoiceSeq = 8831;

  readonly selectedServices = computed(() => this.services().filter((s) => s.selected));
  readonly categories = computed(() => [...new Set(this.selectedServices().map((s) => s.category))]);

  /** Bases stand in for aggregates that Cloud Functions will maintain in Firestore. */
  readonly base = { earnings: 23850, done: 25, upi: 15990, upcoming: 4, walkins: 15, online: 14 };

  constructor() {
    this.hydrate();
    this.seedToday();
    setInterval(() => this.nowMin.set(this.currentMinute()), 30_000);
    effect(() => {
      const snapshot = {
        profile: this.profile(), services: this.services(), timings: this.timings(), brk: this.brk(),
        slotMode: this.slotMode(), buffer: this.buffer(), customIntervals: this.customIntervals(),
        staff: this.staff(), onboarded: this.onboarded(), settings: this.settings(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch { /* storage unavailable */ }
    });
  }

  // ---------- helpers ----------
  private currentMinute() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  staffById(id: string | null | undefined) {
    return this.staff().find((s) => s.id === id);
  }

  serviceById(id: string) {
    return this.services().find((s) => s.id === id);
  }

  private hydrate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.profile) this.profile.set(d.profile);
      if (d.services) this.services.set(d.services);
      if (d.timings) this.timings.set(d.timings);
      if (d.brk) this.brk.set(d.brk);
      if (d.slotMode) this.slotMode.set(d.slotMode);
      if (d.buffer != null) this.buffer.set(d.buffer);
      if (d.customIntervals) this.customIntervals.set(d.customIntervals);
      if (d.staff) this.staff.set(d.staff);
      if (d.settings) this.settings.set({ ...structuredClone(SEED_SETTINGS), ...d.settings });
      if (d.onboarded) this.onboarded.set(true);
    } catch { /* ignore corrupt storage */ }
  }

  markSaved() {
    this.lastSaved.set(new Date());
  }

  // ---------- profile / services / staff ----------
  patchProfile(p: Partial<SalonProfile>) {
    this.profile.update((cur) => ({ ...cur, ...p }));
    this.markSaved();
  }

  toggleService(id: string) {
    this.services.update((l) => l.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));
    this.markSaved();
  }

  patchService(id: string, p: Partial<CatalogService>) {
    this.services.update((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s)));
    this.markSaved();
  }

  addCustomService(name: string, category: string, price: number, duration: number, description: string) {
    const s: CatalogService = {
      id: 'c' + Date.now().toString(36), name, category, description: description || 'Custom service',
      suggestedPrice: price, suggestedDuration: duration,
      durationOptions: [...new Set([15, 30, 45, 60, 90, 120, duration])].sort((a, b) => a - b),
      selected: true, price, duration, custom: true,
    };
    this.services.update((l) => [...l, s]);
    this.markSaved();
  }

  upsertStaff(m: StaffMember) {
    this.staff.update((l) => (l.some((x) => x.id === m.id) ? l.map((x) => (x.id === m.id ? m : x)) : [...l, m]));
    if (!this.stats().some((s) => s.staffId === m.id)) {
      this.stats.update((l) => [...l, { staffId: m.id, clients: 0, workDays: 0, revenue: 0, prevRevenue: 0, week: [0, 0, 0, 0, 0, 0, 0] }]);
    }
    this.markSaved();
  }

  removeStaff(id: string) {
    this.staff.update((l) => l.filter((x) => x.id !== id));
    this.markSaved();
  }

  patchTiming(i: number, p: Partial<DayTiming>) {
    this.timings.update((l) => l.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
    this.markSaved();
  }

  applyMondayToAll() {
    const mon = this.timings()[0];
    this.timings.update((l) => l.map(() => ({ ...mon })));
    this.markSaved();
  }

  completeSetup() {
    this.patchProfile({ slug: slugify(this.profile().name) });
    this.onboarded.set(true);
  }

  // ---------- bookings ----------
  /** Active (non-cancelled) bookings of a day. */
  bookingsFor(date: string) {
    return this.bookings().filter((b) => b.date === date && b.status !== 'cancelled');
  }

  holidayOn(date: string) {
    return this.settings().holidays.find((h) => h.date === date);
  }

  addHoliday(h: Omit<Holiday, 'id'>) {
    this.settings.update((s) => ({ ...s, holidays: [...s.holidays, { ...h, id: 'h' + Date.now().toString(36) }].sort((a, b) => a.date.localeCompare(b.date)) }));
  }

  removeHoliday(id: string) {
    this.settings.update((s) => ({ ...s, holidays: s.holidays.filter((h) => h.id !== id) }));
  }

  dayTiming(date: string): DayTiming {
    return effectiveTiming(this.timings(), this.settings().holidays, date);
  }

  /** Stylists who work on `date` and perform every one of `serviceIds`. */
  eligibleStaff(date: string, serviceIds: string[]) {
    return this.staff().filter((s) => this.staffWorks(s.id, date) && serviceIds.every((id) => s.serviceIds.includes(id)));
  }

  // ---------- customer bookings ----------
  bookingsOfCustomer(phone: string) {
    const digits = phone.replace(/\D/g, '').slice(-10);
    return this.bookings().filter((b) => (b.customerPhone ?? '').slice(-10) === digits);
  }

  private startMs(b: Booking) {
    const [y, m, d] = b.date.split('-').map(Number);
    return new Date(y, m - 1, d, 0, b.start).getTime();
  }

  hoursUntil(b: Booking) {
    return (this.startMs(b) - Date.now()) / 3600000;
  }

  /** Late-cancellation / reschedule fee under the salon policy. */
  cancellationFee(b: Booking) {
    const s = this.settings();
    return cancellationFee({ price: b.price, hoursUntil: this.hoursUntil(b), cancelWindowHrs: s.cancelWindowHrs, latePenaltyPct: s.latePenaltyPct });
  }

  cancelBooking(id: string) {
    this.updateBooking(id, { status: 'cancelled' });
  }

  rescheduleBooking(id: string, date: string, start: number): string | null {
    const b = this.bookings().find((x) => x.id === id);
    if (!b) return 'Booking not found.';
    const err = this.checkBooking(date, b.staffId, start, b.duration, id);
    if (err) return err;
    this.updateBooking(id, { date, start });
    return null;
  }

  createOnlineBooking(input: {
    date: string; staffId: string; serviceIds: string[]; start: number; client: string; phone: string; payment: 'online' | 'salon';
  }): { ok: true; booking: Booking } | { ok: false; error: string } {
    const svcs = input.serviceIds.map((id) => this.serviceById(id)).filter((s): s is CatalogService => !!s);
    if (!svcs.length) return { ok: false, error: 'Select at least one service.' };
    const duration = svcs.reduce((a, s) => a + s.duration, 0);
    const price = svcs.reduce((a, s) => a + s.price, 0);
    const staffId =
      input.staffId === 'any'
        ? this.eligibleStaff(input.date, input.serviceIds).find((s) => !this.checkBooking(input.date, s.id, input.start, duration))?.id
        : input.staffId;
    if (!staffId) return { ok: false, error: 'No stylist is free at that time. Please pick another slot.' };
    const error = this.checkBooking(input.date, staffId, input.start, duration);
    if (error) return { ok: false, error };
    const booking: Booking = {
      id: 'bk' + Date.now().toString(36),
      date: input.date, staffId, client: input.client, phone: input.phone, customerPhone: input.phone.replace(/\D/g, '').slice(-10),
      serviceName: svcs.map((s) => s.name).join(' + '), start: input.start, duration, price, status: 'confirmed',
      services: svcs.map((s) => ({ name: s.name, price: s.price, duration: s.duration })),
      payment: input.payment, paid: input.payment === 'online', source: 'online',
      bookingNo: 'CH-' + this.profile().slug.replace(/[^a-z]/g, '').slice(0, 5).toUpperCase() + '-' + String(Math.floor(10000 + Math.random() * 89999)),
    };
    this.bookings.update((l) => [...l, booking]);
    return { ok: true, booking };
  }

  staffWorks(staffId: string, date: string) {
    const s = this.staffById(staffId);
    return !!s && s.days[weekdayIndex(date)] && this.dayTiming(date).open;
  }

  checkBooking(date: string, staffId: string, start: number, duration: number, ignoreId?: string): string | null {
    // Salon rules come from the shared module (identical on the server); staff and clash checks need local data.
    const rule = checkSalonRules(this.dayTiming(date), this.brk(), start, duration);
    if (rule === 'closed') return 'The salon is closed on this day.';
    if (!this.staffWorks(staffId, date)) return 'This stylist is not working on the selected day.';
    if (rule === 'hours') return 'Outside salon working hours.';
    if (rule === 'break') return 'Overlaps the daily break.';
    const clash = this.bookingsFor(date).some(
      (x) => x.staffId === staffId && x.id !== ignoreId && overlaps(start, start + duration, x.start, x.start + x.duration),
    );
    return clash ? 'This stylist already has a booking in that time.' : null;
  }

  addBooking(b: Omit<Booking, 'id'>): { ok: boolean; error?: string } {
    const error = this.checkBooking(b.date, b.staffId, b.start, b.duration);
    if (error) return { ok: false, error };
    this.bookings.update((l) => [...l, { ...b, id: 'bk' + Date.now().toString(36) + l.length }]);
    return { ok: true };
  }

  /** Adds a service to an existing booking if the stylist is free for the extra time. */
  addOnService(bookingId: string, serviceId: string): string | null {
    const b = this.bookings().find((x) => x.id === bookingId);
    const svc = this.serviceById(serviceId);
    if (!b || !svc) return 'Booking or service not found.';
    const err = this.checkBooking(b.date, b.staffId, b.start, b.duration + svc.duration, bookingId);
    if (err) return err;
    const lines = [...(b.services ?? [{ name: b.serviceName, price: b.price, duration: b.duration }]), { name: svc.name, price: svc.price, duration: svc.duration }];
    this.updateBooking(bookingId, { services: lines, serviceName: lines.map((l) => l.name).join(' + '), price: b.price + svc.price, duration: b.duration + svc.duration });
    return null;
  }

  /** Pushes a booking later (client running late) if the stylist stays free. */
  delayBooking(bookingId: string, minutes: number): string | null {
    const b = this.bookings().find((x) => x.id === bookingId);
    if (!b) return 'Booking not found.';
    const err = this.checkBooking(b.date, b.staffId, b.start + minutes, b.duration, bookingId);
    if (err) return err;
    this.updateBooking(bookingId, { start: b.start + minutes });
    return null;
  }

  updateBooking(id: string, patch: Partial<Booking>) {
    this.bookings.update((l) => l.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  removeBooking(id: string) {
    this.bookings.update((l) => l.filter((b) => b.id !== id));
  }

  freeSlots(date: string, minDuration = 45): FreeSlot[] {
    const t = this.dayTiming(date);
    if (!t.open) return [];
    const open = toMin(t.start);
    const close = toMin(t.end);
    const b = this.brk();
    const isToday = date === dateKey(new Date());
    const floor = isToday ? Math.max(open, Math.ceil(this.nowMin() / 15) * 15) : open;
    const out: FreeSlot[] = [];
    for (const s of this.staff()) {
      if (!this.staffWorks(s.id, date)) continue;
      const busy = this.bookingsFor(date)
        .filter((x) => x.staffId === s.id)
        .map((x) => [x.start, x.start + x.duration] as [number, number]);
      if (b.enabled && b.blockSlots) busy.push([toMin(b.start), toMin(b.end)]);
      busy.sort((a, c) => a[0] - c[0]);
      let cursor = floor;
      for (const [bs, be] of busy) {
        if (bs - cursor >= minDuration) out.push({ staffId: s.id, start: cursor, end: bs });
        cursor = Math.max(cursor, be);
      }
      if (close - cursor >= minDuration) out.push({ staffId: s.id, start: cursor, end: close });
    }
    return out.sort((a, c) => a.start - c.start);
  }

  // ---------- queue ----------
  addWalkIn(client: string, phone: string, serviceId: string, staffId: string | null) {
    const s = this.serviceById(serviceId);
    if (!s) return;
    const item: QueueItem = {
      id: 'q' + Date.now().toString(36), stage: 'waiting', client, phone: phone || 'Walk-in',
      service: s.name, category: s.category, price: s.price, duration: s.duration,
      requestedStaffId: staffId, staffId: null, station: null, source: 'walkin',
      arrivedAt: this.nowMin(), startedAt: null,
    };
    this.queue.update((l) => [...l, item]);
  }

  /** Puts a waiting client in a chair. Returns error text if no stylist is free. */
  seat(id: string, staffId?: string): string | null {
    const item = this.queue().find((q) => q.id === id);
    if (!item) return 'Client not found.';
    const busy = new Set(this.queue().filter((q) => q.stage === 'in-chair').map((q) => q.staffId));
    const candidates = this.staff().filter((s) => s.status === 'on-duty' && !busy.has(s.id));
    const pick = staffId ? this.staffById(staffId) : candidates.find((s) => s.id === item.requestedStaffId) ?? candidates[0];
    if (!pick) return 'All stylists are currently with clients.';
    if (busy.has(pick.id)) return `${pick.name} is busy.`;
    const station = this.staff().findIndex((s) => s.id === pick.id) + 1;
    this.queue.update((l) =>
      l.map((q) => (q.id === id ? { ...q, stage: 'in-chair', staffId: pick.id, station, startedAt: this.nowMin() } : q)),
    );
    return null;
  }

  // ---------- billing ----------
  nextInvoiceNo() {
    const d = new Date();
    const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    const fy = `${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
    return `CH/${fy}/${String(this.invoiceSeq + 1).padStart(5, '0')}`;
  }

  /** Prices are GST-inclusive. The discount comes off the inclusive total; tax is shown only if the salon is GST registered. */
  createBill(input: {
    client: string; phone: string; lines: BillLine[]; discount: number; couponCode?: string; method: PayMethod; queueId?: string | null;
  }): Bill {
    const subtotal = input.lines.reduce((a, l) => a + l.price * l.qty, 0);
    const discount = clampDiscount(subtotal, input.discount);
    const total = subtotal - discount;
    const { gstRegistered, gstin } = this.settings();
    const tax = splitGst(total, gstRegistered);
    const no = this.nextInvoiceNo();
    this.invoiceSeq++;
    const bill: Bill = {
      no, client: input.client, phone: input.phone, lines: input.lines, subtotal, discount, couponCode: input.couponCode,
      taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, gst: tax.gst, gstRegistered, gstin: gstRegistered ? gstin : undefined,
      total, method: input.method, createdAt: new Date().toISOString(),
    };
    this.bills.update((l) => [bill, ...l]);
    this.touchCustomer(input.client, input.phone, { visit: true, spent: total });
    const primary = input.lines[0];
    const stamp = { stage: 'done' as const, billNo: no, payMethod: input.method, price: total, billedAt: bill.createdAt };
    if (input.queueId) {
      this.queue.update((l) => l.map((q) => (q.id === input.queueId ? { ...q, ...stamp } : q)));
    } else {
      this.queue.update((l) => [
        ...l,
        {
          id: 'q' + Date.now().toString(36), client: input.client, phone: input.phone || 'Walk-in',
          service: input.lines.map((x) => x.name).join(', '), category: this.serviceById(primary?.serviceId)?.category ?? 'Hair',
          duration: 0, requestedStaffId: null, staffId: primary?.staffId ?? null, station: null, source: 'walkin' as const,
          arrivedAt: this.nowMin(), startedAt: null, ...stamp,
        },
      ]);
    }
    return bill;
  }

  // ---------- coupons (mock catalogue until coupon management is built) ----------
  applyCoupon(code: string, subtotal: number): { ok: true; discount: number; label: string } | { ok: false } {
    const c = COUPONS[code.trim().toUpperCase()];
    if (!c) return { ok: false };
    const discount = c.type === 'percent' ? Math.round((subtotal * c.value) / 100) : Math.min(c.value, subtotal);
    return { ok: true, discount, label: c.label };
  }

  // ---------- customers ----------
  private phoneKey(phone: string) {
    return phoneKey(phone);
  }

  noShowsOf(phone: string) {
    const k = this.phoneKey(phone);
    return k ? this.customers().find((c) => c.id === `p_${k}`)?.noShowCount ?? 0 : 0;
  }

  /** Creates or updates the per-salon customer record (a Cloud Function does this in Firestore later). */
  touchCustomer(name: string, phone: string, change: { visit?: boolean; spent?: number; noShow?: boolean }, uid: string | null = null) {
    // Same key the Firestore document will have: salons/{id}/customers/p_<last10digits> (n_<name> without a phone).
    const id = customerKey(phone, name);
    const today = dateKey(new Date());
    this.customers.update((list) => {
      const i = list.findIndex((c) => c.id === id);
      const base: CustomerRecord = i >= 0 ? list[i] : { id, uid, name, phone: phone || '', visits: 0, totalSpent: 0, lastVisit: '', noShowCount: 0 };
      const next: CustomerRecord = {
        ...base,
        uid: base.uid ?? uid,
        name: base.name || name,
        phone: base.phone || phone,
        visits: base.visits + (change.visit ? 1 : 0),
        totalSpent: base.totalSpent + (change.spent ?? 0),
        lastVisit: change.visit ? today : base.lastVisit,
        noShowCount: base.noShowCount + (change.noShow ? 1 : 0),
      };
      return i >= 0 ? list.map((c, idx) => (idx === i ? next : c)) : [...list, next];
    });
  }

  /** Marks a booking as a no-show and counts it against the customer. */
  markNoShow(id: string) {
    const b = this.bookings().find((x) => x.id === id);
    if (!b || b.status === 'no-show') return;
    this.updateBooking(id, { status: 'no-show' });
    this.touchCustomer(b.client, b.customerPhone ?? b.phone, { noShow: true });
  }

  /** Completing a booking counts a visit and the amount spent. */
  completeBooking(id: string) {
    const b = this.bookings().find((x) => x.id === id);
    if (!b || b.status === 'completed') return;
    this.updateBooking(id, { status: 'completed' });
    this.touchCustomer(b.client, b.customerPhone ?? b.phone, { visit: true, spent: b.price });
  }

  private seedToday() {
    const today = dateKey(new Date());
    const b = (id: string, staffId: string, client: string, phone: string, serviceName: string, start: string, duration: number, price: number, status: Booking['status'], notes?: string): Booking =>
      ({ id, date: today, staffId, client, phone, serviceName, start: toMin(start), duration, price, status, notes });
    this.bookings.set([
      b('b1', 'st2', 'Rohan Kapoor', '+91 98201 44521', 'Classic Layer Cut + Wash', '09:30', 90, 1450, 'in-progress'),
      b('b2', 'st2', 'Kavita Deshmukh', '+91 97652 11984', 'Balayage + Keratin Express', '14:30', 120, 5200, 'vip', 'Prefers sulfate-free lavender wash.'),
      b('b3', 'st2', 'Tanya Varma', '+91 99001 22334', 'Deep Conditioning Spa', '17:30', 60, 1800, 'confirmed'),
      b('b4', 'st3', 'Ananya Mehta', '+91 99200 88219', 'Balayage + Blowdry Master', '09:00', 180, 6800, 'in-progress', 'Olaplex Step 1 + Wella 8/38 Honey Gold'),
      b('b5', 'st3', 'Simran Kaur', '+91 98710 33410', 'Organic Root Touchup & Spa', '15:00', 120, 3400, 'confirmed'),
      { ...b('b6', 'st1', 'Devraj Roy', '+91 98111 22334', 'Beard Sculpt & Fade', '09:00', 60, 950, 'completed'), paid: true, payment: 'online' as const },
      { ...b('b7', 'st1', 'Harshvardhan Kapoor', '+91 98111 00293', 'Royal Shave + Charcoal Facial', '10:30', 90, 2800, 'in-progress'), vip: true },
      b('b8', 'st1', 'Gaurav Sethi', '+91 98330 11223', 'Scissor Taper Cut', '14:30', 60, 1100, 'confirmed'),
      b('b9', 'st1', 'Zayn Merchant', '+91 99882 11094', 'Signature Hair Tattoo + Fade', '16:00', 90, 2100, 'confirmed'),
      b('b10', 'st4', 'Pooja Nambiar', '+91 98450 77332', 'Gel Extension + Chrome Art', '10:00', 90, 2650, 'confirmed'),
      b('b11', 'st4', 'Meera Sen', '+91 97120 54109', 'Hydra Glow Facial Therapy', '14:00', 90, 3800, 'confirmed'),
      ...this.seedCustomer(),
    ]);

    const now = this.nowMin();
    const q = (id: string, stage: QueueItem['stage'], client: string, phone: string, service: string, category: string, price: number, duration: number,
      p: Partial<QueueItem>): QueueItem => ({
      id, stage, client, phone, service, category, price, duration, requestedStaffId: null, staffId: null, station: null,
      source: 'app', arrivedAt: now - 10, startedAt: null, ...p,
    });
    this.queue.set([
      q('q1', 'waiting', 'Rohan Verma', '+91 98451 ••••2', 'Fade Cut + Beard', 'Hair', 750, 60, { requestedStaffId: 'st1', arrivedAt: now - 12 }),
      q('q2', 'waiting', 'Priya Kapur', '+91 99203 ••••8', 'Keratin Touchup', 'Hair', 2800, 90, { requestedStaffId: 'st2', arrivedAt: now - 5 }),
      q('q3', 'waiting', 'Amit Saxena', 'Walk-in #4', 'Classic Shave', 'Grooming', 400, 30, { source: 'walkin', arrivedAt: now - 18 }),
      q('q4', 'in-chair', 'Vikram Joshi', '+91 90000 11111', 'Balayage Tint', 'Hair', 3400, 60, { staffId: 'st1', station: 1, startedAt: now - 36 }),
      q('q5', 'in-chair', 'Divya Mehra', '+91 90000 22222', 'Moroccan Head Spa', 'Spa', 1950, 60, { staffId: 'st3', station: 3, startedAt: now - 52 }),
      q('q6', 'in-chair', 'Karan Chawla', '+91 90000 33333', 'Styling & Wash', 'Hair', 850, 40, { staffId: 'st2', station: 2, startedAt: now - 25 }),
      q('q7', 'done', 'Manish Malhotra', '', 'Signature Haircut', 'Hair', 1600, 45, { staffId: 'st1', billNo: 'CH/25-26/08831', payMethod: 'UPI', billedAt: this.iso(now - 10) }),
      q('q8', 'done', 'Neha Singhal', '', 'Keratin Treatment', 'Hair', 2100, 90, { staffId: 'st2', billNo: 'CH/25-26/08830', payMethod: 'Cash', billedAt: this.iso(now - 32) }),
      q('q9', 'done', 'Arjun Nair', '', 'Beard Spa', 'Grooming', 900, 30, { staffId: 'st4', billNo: 'CH/25-26/08829', payMethod: 'UPI', billedAt: this.iso(now - 57) }),
    ]);
  }

  /** Bookings of the demo customer (+91 98765 43210) across past and future dates. */
  private seedCustomer(): Booking[] {
    const phone = '+91 98765 43210';
    const mk = (id: string, off: number, staffId: string, svcs: [string, number, number][], start: string, status: Booking['status'], payment: 'online' | 'salon'): Booking => ({
      id, date: plusDays(off), staffId, client: 'Ananya Roy', phone, customerPhone: '9876543210',
      serviceName: svcs.map((x) => x[0]).join(' + '), start: toMin(start), duration: svcs.reduce((a, x) => a + x[2], 0),
      price: svcs.reduce((a, x) => a + x[1], 0), status, services: svcs.map(([name, price, duration]) => ({ name, price, duration })),
      payment, paid: payment === 'online' || status === 'completed', bookingNo: 'CH-LUXE-' + (80000 + Math.abs(off) * 7 + id.length), source: 'online',
    });
    return [
      mk('cb1', 1, 'st1', [['Signature Haircut & Styling', 450, 45], ['Beard Trim & Shape', 250, 25]], '10:15', 'confirmed', 'online'),
      mk('cb2', 9, 'st3', [['Hydra-Glow Facial', 1500, 60]], '16:30', 'confirmed', 'salon'),
      mk('cb3', -6, 'st2', [['Keratin Hair Treatment', 2800, 90]], '11:00', 'completed', 'online'),
      mk('cb4', -21, 'st1', [['Signature Haircut & Styling', 450, 45]], '17:30', 'completed', 'salon'),
      mk('cb5', -40, 'st3', [['Head Massage & Aromatherapy', 600, 30]], '12:00', 'completed', 'online'),
    ];
  }

  private iso(min: number) {
    const d = new Date();
    d.setHours(0, min, 0, 0);
    return d.toISOString();
  }

}
