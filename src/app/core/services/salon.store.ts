import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  DocumentData, QuerySnapshot, QueryDocumentSnapshot, Unsubscribe, addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, Query,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  Bill, BillLine, Booking, Holiday, BreakSettings, CatalogService, DayTiming, PayMethod,
  CustomerRecord, QueueItem, SalonProfile, SalonSettings, StaffMember,
} from '../models';
import {
  DEFAULT_BREAK, DEFAULT_SETTINGS, DEFAULT_TIMINGS, GSTIN_PATTERN, addDays, cancellationFee, checkSalonRules, clampDiscount, customerKey, effectiveTiming, overlaps, phoneKey, splitGst, weekdayIndex,
} from '@chairly/shared';
import { FirebaseService } from '../firebase/firebase.service';
import { dateKey, toMin } from '../utils/time';
import { mapBill, mapBooking, mapCustomer, mapQueue, mapService, mapStaff } from './mappers';
import { ToastService } from './toast.service';

type Mode = 'none' | 'owner' | 'staff' | 'public';
export type SalonStatus = 'draft' | 'active' | 'suspended';

const EMPTY_PROFILE: SalonProfile = {
  name: '', category: 'Unisex', phone: '', email: '', street: '', landmark: '', city: '', pin: '', state: '', lat: 0, lng: 0, logo: null, slug: '',
};

const freshSettings = (): SalonSettings => ({ ...DEFAULT_SETTINGS, holidays: [], bank: null, plan: 'Trial', trialEndsAt: '' });

const COUPONS: Record<string, { type: 'percent' | 'flat'; value: number; label: string }> = {
  WELCOME10: { type: 'percent', value: 10, label: '10% off' },
  FLAT100: { type: 'flat', value: 100, label: '₹100 off' },
};

export interface FreeSlot { staffId: string; start: number; end: number }

/** Callable errors already carry a user-safe message; anything else becomes a generic line. */
export function callableMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const msg = (e as { message?: string })?.message ?? '';
  if (code === 'functions/unauthenticated') return 'Please sign in to continue.';
  return code.startsWith('functions/') && msg && !/^internal$/i.test(msg) ? msg : 'Something went wrong. Please try again.';
}

/**
 * The one place the UI reads and writes salon data. One salon is loaded at a time, in one of three modes:
 *  - owner:  full read/write of that salon (its setup, live bookings, queue, bills, customers)
 *  - staff:  the stylist's own bookings and the salon's public data
 *  - public: what a customer sees at /s/:slug (setup + which slots are already taken)
 * Setup edits (profile, hours, services, staff) save straight to Firestore under the security rules. Everything that
 * must be race-free or tamper-proof (bookings, bills, invoice numbers) goes through Cloud Functions.
 */
@Injectable({ providedIn: 'root' })
export class SalonStore {
  private readonly fb = inject(FirebaseService);
  private readonly toast = inject(ToastService);

  readonly mode = signal<Mode>('none');
  readonly salonId = signal<string | null>(null);
  readonly status = signal<SalonStatus | null>(null);
  readonly bookable = signal(false);
  readonly notFound = signal(false);
  readonly loading = signal(false);

  readonly profile = signal<SalonProfile>({ ...EMPTY_PROFILE });
  readonly services = signal<CatalogService[]>([]);
  readonly timings = signal<DayTiming[]>(structuredClone(DEFAULT_TIMINGS));
  readonly brk = signal<BreakSettings>({ ...DEFAULT_BREAK });
  readonly settings = signal<SalonSettings>(freshSettings());
  readonly slotMode = signal<'auto' | 'custom'>('auto');
  readonly buffer = signal(10);
  readonly customIntervals = signal<number[]>([30, 45, 60]);
  readonly customInterval = signal(30);
  /** Every stylist ever added (kept so old bookings can still show a name); `staff` is the active team. */
  readonly staffAll = signal<StaffMember[]>([]);
  readonly staff = computed(() => this.staffAll().filter((s) => s.active !== false));
  readonly bookings = signal<Booking[]>([]);
  /** Customer mode: stretches of each stylist's day that are already taken, as anonymous placeholders. */
  private readonly busy = signal<Booking[]>([]);
  readonly queue = signal<QueueItem[]>([]);
  readonly bills = signal<Bill[]>([]);
  readonly customers = signal<CustomerRecord[]>([]);
  /** The signed-in customer's own no-show count at this salon (public mode). */
  private readonly myNoShows = signal(0);
  readonly onboarded = computed(() => this.status() === 'active');
  /** Last salon page this device opened; the customer's bottom bar links back to it from pages that have no salon (My bookings). */
  readonly lastSlug = signal(this.readLastSlug());
  readonly lastSaved = signal<Date | null>(null);
  readonly nowMin = signal(this.currentMinute());

  readonly selectedServices = computed(() => this.services().filter((s) => s.selected));
  readonly categories = computed(() => [...new Set(this.selectedServices().map((s) => s.category))]);

  private unsubs: Unsubscribe[] = [];
  private loadPromise: Promise<void> | null = null;
  private loadedKey = '';
  private hydrated = false;
  private savedJson = '';
  private persistTimer?: ReturnType<typeof setTimeout>;
  private readonly serviceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private queueDay = dateKey(new Date());
  private saveFailedShown = false;

  constructor() {
    setInterval(() => {
      this.nowMin.set(this.currentMinute());
      // The queue is per day: roll it over at midnight without a reload.
      if (this.mode() === 'owner' && this.queueDay !== dateKey(new Date())) this.watchQueue();
    }, 30_000);
    effect(() => {
      const snapshot = { profile: this.profile(), timings: this.timings(), brk: this.brk(), settings: this.settings(), slotMode: this.slotMode(), buffer: this.buffer(), customIntervals: this.customIntervals() };
      untracked(() => this.schedulePersist(snapshot));
    });
  }

  // ---------- loading ----------
  /** Forgets everything (sign-out, or switching to another salon). */
  reset() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.loadPromise = null;
    this.loadedKey = '';
    this.hydrated = false;
    this.savedJson = '';
    clearTimeout(this.persistTimer);
    this.mode.set('none');
    this.salonId.set(null);
    this.status.set(null);
    this.bookable.set(false);
    this.notFound.set(false);
    this.profile.set({ ...EMPTY_PROFILE });
    this.services.set([]);
    this.timings.set(structuredClone(DEFAULT_TIMINGS));
    this.brk.set({ ...DEFAULT_BREAK });
    this.settings.set(freshSettings());
    this.slotMode.set('auto');
    this.buffer.set(10);
    this.customIntervals.set([30, 45, 60]);
    this.staffAll.set([]);
    this.bookings.set([]);
    this.busy.set([]);
    this.queue.set([]);
    this.bills.set([]);
    this.customers.set([]);
    this.myNoShows.set(0);
  }

  /** Owner: loads that salon's setup and starts live listeners for bookings, queue, bills and customers. */
  loadOwner(salonId: string): Promise<void> {
    return this.load('owner', salonId, () => this.doLoadOwner(salonId));
  }

  /** Stylist: the salon's public setup plus this stylist's own bookings. */
  loadStaff(salonId: string, staffId: string): Promise<void> {
    return this.load('staff', salonId + '/' + staffId, () => this.doLoadStaff(salonId, staffId));
  }

  /** Customer: resolves /s/:slug to a salon and loads what a customer may see. Returns false when there is no such salon. */
  async loadPublic(slug: string): Promise<boolean> {
    const key = 'public:' + slug;
    if (this.loadedKey === key && this.loadPromise) {
      await this.loadPromise;
      return !this.notFound();
    }
    this.reset();
    this.loadedKey = key;
    this.loadPromise = this.doLoadPublic(slug);
    try {
      await this.loadPromise;
    } catch {
      this.loadedKey = '';
      this.loadPromise = null;
      throw new Error('load-failed');
    }
    if (!this.notFound()) this.rememberSlug(slug);
    return !this.notFound();
  }

  private readLastSlug(): string {
    try {
      return localStorage.getItem('chairly.lastSlug') ?? '';
    } catch {
      return '';
    }
  }

  private rememberSlug(slug: string) {
    this.lastSlug.set(slug);
    try {
      localStorage.setItem('chairly.lastSlug', slug);
    } catch {
      /* storage unavailable */
    }
  }

  private load(mode: Mode, id: string, run: () => Promise<void>): Promise<void> {
    const key = mode + ':' + id;
    if (this.loadedKey === key && this.loadPromise) return this.loadPromise;
    this.reset();
    this.loadedKey = key;
    this.mode.set(mode);
    this.loadPromise = run().catch((e) => {
      this.loadedKey = '';
      this.loadPromise = null;
      throw e;
    });
    return this.loadPromise;
  }

  private col(path: string) {
    return collection(this.fb.db, `salons/${this.salonId()}/${path}`);
  }

  private async fetchSetup(salonId: string, opts: { onlyActive: boolean }) {
    const db = this.fb.db;
    const [salon, services, staff] = await Promise.all([
      getDoc(doc(db, `salons/${salonId}`)),
      getDocs(collection(db, `salons/${salonId}/services`)),
      getDocs(collection(db, `salons/${salonId}/staff`)),
    ]);
    if (!salon.exists()) throw new Error('salon-missing');
    this.salonId.set(salonId);
    this.applySalon(salon.data());
    const bySort = (a: DocumentData, b: DocumentData) => (a['sortOrder'] ?? 0) - (b['sortOrder'] ?? 0);
    const svc = services.docs.map((d) => d.data()).length ? [...services.docs].sort((a, b) => bySort(a.data(), b.data())).map((d) => mapService(d.id, d.data())) : [];
    this.services.set(opts.onlyActive ? svc.filter((s) => s.selected) : svc);
    return staff;
  }

  private async doLoadOwner(salonId: string) {
    const db = this.fb.db;
    this.loading.set(true);
    try {
      const staffSnap = await this.fetchSetup(salonId, { onlyActive: false });
      const priv = await getDocs(collection(db, `salons/${salonId}/staffPrivate`));
      const privById = new Map(priv.docs.map((d) => [d.id, d.data()]));
      this.staffAll.set(this.sortedStaff(staffSnap, (d) => privById.get(d.id)));
      const billing = await getDoc(doc(db, `salons/${salonId}/private/billing`));
      if (billing.exists()) {
        const b = billing.data();
        const ends = b['trialEndsAt']?.toDate?.() as Date | undefined;
        this.settings.update((s) => ({ ...s, plan: b['plan'] ?? s.plan, trialEndsAt: ends ? dateKey(ends) : s.trialEndsAt, billingStatus: b['status'] }));
      }
      this.savedJson = JSON.stringify(this.configSnapshot());
      this.hydrated = true;

      const from = addDays(dateKey(new Date()), -70);
      await Promise.all([
        this.listen(query(this.col('bookings'), where('date', '>=', from)), (s) => this.bookings.set(s.docs.map((d) => mapBooking(d.id, d.data())).filter((b) => b.status !== 'expired'))),
        this.listen(query(this.col('bills'), where('date', '>=', from)), (s) => this.bills.set(s.docs.map((d) => mapBill(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))),
        this.listen(this.col('customers'), (s) => this.customers.set(s.docs.map((d) => mapCustomer(d.id, d.data())))),
        this.watchQueue(),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  private async doLoadStaff(salonId: string, staffId: string) {
    const db = this.fb.db;
    this.loading.set(true);
    try {
      const staffSnap = await this.fetchSetup(salonId, { onlyActive: true });
      const priv = await getDoc(doc(db, `salons/${salonId}/staffPrivate/${staffId}`));
      this.staffAll.set(this.sortedStaff(staffSnap, (d) => (d.id === staffId ? priv.data() : undefined)));
      this.mode.set('staff');
      const from = addDays(dateKey(new Date()), -70);
      await this.listen(
        query(this.col('bookings'), where('staffId', '==', staffId), where('date', '>=', from)),
        (s) => this.bookings.set(s.docs.map((d) => mapBooking(d.id, d.data())).filter((b) => b.status !== 'expired')),
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async doLoadPublic(slug: string) {
    this.loading.set(true);
    try {
      const s = await getDoc(doc(this.fb.db, `slugs/${slug}`));
      if (!s.exists()) return this.notFound.set(true);
      const salonId = s.get('salonId') as string;
      const staffSnap = await this.fetchSetup(salonId, { onlyActive: true });
      if (this.status() !== 'active') return this.notFound.set(true);
      this.staffAll.set(this.sortedStaff(staffSnap, () => undefined).filter((m) => m.active !== false));
      this.mode.set('public');
      void this.refreshBusy(); // slot screens refresh it too; the salon page must not wait on it
    } finally {
      this.loading.set(false);
    }
  }

  /** Stylists in the order the owner arranged them, with the private part (phone, commission) joined in when it is readable. */
  private sortedStaff(snap: QuerySnapshot<DocumentData>, priv: (d: QueryDocumentSnapshot<DocumentData>) => DocumentData | undefined): StaffMember[] {
    return [...snap.docs]
      .sort((a, b) => (a.get('order') ?? 0) - (b.get('order') ?? 0))
      .map((d) => ({ ...mapStaff(d.id, d.data(), priv(d)), active: d.get('active') !== false }));
  }

  /** Subscribes and resolves after the first snapshot (or a failure), so pages start with data instead of empty lists. */
  private listen(q: Query<DocumentData> | ReturnType<typeof collection>, onData: (s: QuerySnapshot<DocumentData>) => void): Promise<void> {
    return new Promise((resolve) => {
      let first = true;
      const done = () => {
        if (first) {
          first = false;
          resolve();
        }
      };
      this.unsubs.push(
        onSnapshot(
          q as Query<DocumentData>,
          (s) => {
            onData(s);
            done();
          },
          () => done(),
        ),
      );
    });
  }

  private watchQueue(): Promise<void> {
    this.queueDay = dateKey(new Date());
    return this.listen(query(this.col('queue'), where('date', '==', this.queueDay)), (s) => this.queue.set(s.docs.map((d) => mapQueue(d.id, d.data()))));
  }

  private applySalon(d: DocumentData) {
    const p = d['profile'] ?? {};
    this.profile.set({
      name: p.name ?? '', category: p.category ?? 'Unisex', phone: p.phone ?? '', email: p.email ?? '', street: p.street ?? '', landmark: p.landmark ?? '',
      city: p.city ?? '', pin: p.pin ?? '', state: p.state ?? '', lat: p.lat ?? 0, lng: p.lng ?? 0, logo: d['logoUrl'] ?? null, slug: d['slug'] ?? '',
    });
    this.status.set(d['status'] ?? 'draft');
    this.bookable.set(!!d['bookable']);
    if (d['timings']?.length === 7) this.timings.set(d['timings']);
    if (d['breaks']) this.brk.set({ ...DEFAULT_BREAK, ...d['breaks'] });
    this.slotMode.set(d['slotMode'] === 'custom' ? 'custom' : 'auto');
    this.buffer.set(d['buffer'] ?? 10);
    this.customIntervals.set(d['customSlots']?.length ? d['customSlots'] : [30, 45, 60]);
    this.settings.set({ ...freshSettings(), ...(d['settings'] ?? {}), holidays: d['holidays'] ?? [] });
  }

  // ---------- persistence of the salon's setup ----------
  private configSnapshot() {
    return { profile: this.profile(), timings: this.timings(), brk: this.brk(), settings: this.settings(), slotMode: this.slotMode(), buffer: this.buffer(), customIntervals: this.customIntervals() };
  }

  private schedulePersist(snapshot: ReturnType<SalonStore['configSnapshot']>) {
    if (this.mode() !== 'owner' || !this.hydrated) return;
    if (JSON.stringify(snapshot) === this.savedJson) return;
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.persist(), 700);
  }

  /** Writes the salon document. Skips states the security rules would reject (e.g. a half-typed name or GSTIN). */
  private async persist() {
    const id = this.salonId();
    if (!id || this.mode() !== 'owner') return;
    const snap = this.configSnapshot();
    const json = JSON.stringify(snap);
    const { profile: p, settings: s } = snap;
    if (p.name.trim().length < 2) return;
    if (s.gstRegistered && !GSTIN_PATTERN.test(s.gstin)) return;
    try {
      await updateDoc(doc(this.fb.db, `salons/${id}`), {
        profile: { name: p.name.trim(), category: p.category, phone: p.phone, email: p.email, street: p.street, landmark: p.landmark, city: p.city, pin: p.pin, state: p.state, lat: p.lat, lng: p.lng },
        logoUrl: p.logo,
        timings: snap.timings,
        breaks: snap.brk,
        holidays: s.holidays,
        slotMode: snap.slotMode,
        customSlots: snap.customIntervals,
        buffer: snap.buffer,
        settings: {
          allowPayAtSalon: s.allowPayAtSalon, requireOnlineAfterNoShows: s.requireOnlineAfterNoShows, noShowThreshold: s.noShowThreshold, cancelWindowHrs: s.cancelWindowHrs,
          latePenaltyPct: s.latePenaltyPct, hindiSupport: s.hindiSupport, gstRegistered: s.gstRegistered, gstin: s.gstRegistered ? s.gstin : '', upiId: s.upiId ?? '',
        },
        updatedAt: serverTimestamp(),
      });
      this.savedJson = json;
      this.lastSaved.set(new Date());
      this.saveFailedShown = false;
    } catch {
      if (!this.saveFailedShown) this.toast.error('Could not save your changes. Check your connection.');
      this.saveFailedShown = true;
    }
  }

  markSaved() {
    this.lastSaved.set(new Date());
  }

  /** Saves any pending setup edit right away (used before leaving a screen). */
  async flush() {
    clearTimeout(this.persistTimer);
    if (this.hydrated && JSON.stringify(this.configSnapshot()) !== this.savedJson) await this.persist();
  }

  private async write<T>(job: Promise<T>, failure = 'Could not save your changes. Check your connection.'): Promise<T | undefined> {
    try {
      return await job;
    } catch {
      this.toast.error(failure);
      return undefined;
    }
  }

  // ---------- helpers ----------
  private currentMinute() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  staffById(id: string | null | undefined) {
    return this.staffAll().find((s) => s.id === id);
  }

  serviceById(id: string) {
    return this.services().find((s) => s.id === id);
  }

  // ---------- profile / services / staff ----------
  patchProfile(p: Partial<SalonProfile>) {
    this.profile.update((cur) => ({ ...cur, ...p }));
    this.markSaved();
  }

  private serviceDoc(s: CatalogService, order: number) {
    return {
      name: s.name, category: s.category, description: s.description, price: s.price, duration: Math.round(s.duration), active: s.selected, custom: !!s.custom,
      sortOrder: order, updatedAt: serverTimestamp(),
    };
  }

  private saveService(id: string, immediate = true) {
    if (this.mode() !== 'owner') return;
    const run = () => {
      const list = this.services();
      const i = list.findIndex((x) => x.id === id);
      const s = list[i];
      if (!s || s.name.trim().length < 2 || !(s.price >= 0)) return;
      void this.write(setDoc(doc(this.fb.db, `salons/${this.salonId()}/services/${id}`), this.serviceDoc(s, i), { merge: true }));
      this.lastSaved.set(new Date());
    };
    clearTimeout(this.serviceTimers.get(id));
    if (immediate) run();
    else this.serviceTimers.set(id, setTimeout(run, 600));
  }

  toggleService(id: string) {
    this.services.update((l) => l.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));
    this.saveService(id);
  }

  patchService(id: string, p: Partial<CatalogService>) {
    this.services.update((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s)));
    this.saveService(id, false);
  }

  addCustomService(name: string, category: string, price: number, duration: number, description: string) {
    const id = 'c' + Date.now().toString(36);
    const s: CatalogService = {
      id, name, category, description: description || 'Custom service', suggestedPrice: price, suggestedDuration: duration,
      durationOptions: [...new Set([15, 30, 45, 60, 90, 120, duration])].sort((a, b) => a - b), selected: true, price, duration, custom: true,
    };
    this.services.update((l) => [...l, s]);
    this.saveService(id);
  }

  upsertStaff(m: StaffMember) {
    const exists = this.staffAll().some((x) => x.id === m.id);
    const next = { ...m, active: true };
    this.staffAll.update((l) => (exists ? l.map((x) => (x.id === m.id ? next : x)) : [...l, next]));
    if (this.mode() !== 'owner') return;
    const id = this.salonId();
    const order = this.staffAll().findIndex((x) => x.id === m.id);
    const batch = writeBatch(this.fb.db);
    batch.set(doc(this.fb.db, `salons/${id}/staff/${m.id}`), {
      name: m.name.trim(), role: m.role, title: m.title || m.role, serviceIds: m.serviceIds, days: m.days, photoUrl: m.photo, active: true, status: m.status, order,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    batch.set(doc(this.fb.db, `salons/${id}/staffPrivate/${m.id}`), {
      phone: m.phone, phoneKey: phoneKey(m.phone), email: m.email, commission: Math.min(100, Math.max(0, m.commission)), updatedAt: serverTimestamp(),
    }, { merge: true });
    void this.write(batch.commit());
    this.markSaved();
  }

  /** Stylists are switched off, not deleted, so past bookings keep their names. */
  removeStaff(id: string) {
    this.staffAll.update((l) => l.map((x) => (x.id === id ? { ...x, active: false } : x)));
    if (this.mode() === 'owner') void this.write(updateDoc(doc(this.fb.db, `salons/${this.salonId()}/staff/${id}`), { active: false, status: 'off', updatedAt: serverTimestamp() }));
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

  /** Finishes onboarding: the server validates the setup, reserves the public link and opens for bookings. */
  async completeSetup(): Promise<string> {
    await this.flush();
    const res = await httpsCallable<{ salonId: string }, { slug: string }>(this.fb.functions, 'completeOnboarding')({ salonId: this.salonId()! });
    this.patchProfile({ slug: res.data.slug });
    this.status.set('active');
    return res.data.slug;
  }

  // ---------- bookings ----------
  /** Active bookings of a day (cancelled and expired holds are gone; no-shows stay visible on the calendar). */
  bookingsFor(date: string) {
    const list = this.mode() === 'public' ? this.busy() : this.bookings();
    return list.filter((b) => b.date === date && b.status !== 'cancelled' && b.status !== 'expired');
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

  staffWorks(staffId: string, date: string) {
    const s = this.staffById(staffId);
    return !!s && s.days[weekdayIndex(date)] && this.dayTiming(date).open;
  }

  /** Quick client-side check for instant feedback; the server repeats it inside a transaction and is the authority. */
  checkBooking(date: string, staffId: string, start: number, duration: number, ignoreId?: string): string | null {
    const rule = checkSalonRules(this.dayTiming(date), this.brk(), start, duration);
    if (rule === 'closed') return 'The salon is closed on this day.';
    if (!this.staffWorks(staffId, date)) return 'This stylist is not working on the selected day.';
    if (rule === 'hours') return 'Outside salon working hours.';
    if (rule === 'break') return 'Overlaps the daily break.';
    const clash = this.bookingsFor(date).some(
      (x) => x.staffId === staffId && x.id !== ignoreId && x.status !== 'no-show' && overlaps(start, start + duration, x.start, x.start + x.duration),
    );
    return clash ? 'This stylist already has a booking in that time.' : null;
  }

  private fns() {
    return this.fb.functions;
  }

  /** Refreshes which slots are taken (customer mode). Cheap: one call for the next three weeks. */
  async refreshBusy() {
    const id = this.salonId();
    if (!id || this.mode() !== 'public') return;
    try {
      const res = await httpsCallable<{ salonId: string; from: string; days: number }, { busy: { bookingId: string; staffId: string; date: string; start: number; end: number }[] }>(this.fns(), 'getBusy')({
        salonId: id, from: dateKey(new Date()), days: 21,
      });
      this.busy.set(res.data.busy.map((r) => ({ id: r.bookingId, date: r.date, staffId: r.staffId, client: '', phone: '', serviceName: '', start: r.start, duration: r.end - r.start, price: 0, status: 'confirmed' as const })));
    } catch {
      /* the booking call re-checks everything, so a stale grid is safe */
    }
  }

  /** A signed-in customer books online. Pay-at-salon confirms at once; simulated online payment is recorded as paid. */
  async createOnlineBooking(input: {
    date: string; staffId: string; serviceIds: string[]; start: number; client: string; phone: string; payment: 'online' | 'salon'; requestId: string;
  }): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
    const svcs = input.serviceIds.map((id) => this.serviceById(id)).filter((s): s is CatalogService => !!s);
    if (!svcs.length) return { ok: false, error: 'Select at least one service.' };
    try {
      const res = await httpsCallable<Record<string, unknown>, { bookingId: string; staffId: string; bookingNo: string; price: number }>(this.fns(), 'createBooking')({
        salonId: this.salonId(), requestId: input.requestId, serviceIds: input.serviceIds, staffId: input.staffId, date: input.date, start: input.start,
        customerName: input.client, customerPhone: input.phone.replace(/\D/g, '').slice(-10), paymentMode: input.payment,
      });
      void this.refreshBusy();
      const booking: Booking = {
        id: res.data.bookingId, date: input.date, staffId: res.data.staffId, client: input.client, phone: input.phone, customerPhone: input.phone.replace(/\D/g, '').slice(-10),
        serviceName: svcs.map((s) => s.name).join(' + '), start: input.start, duration: svcs.reduce((a, s) => a + s.duration, 0), price: res.data.price, status: 'confirmed',
        services: svcs.map((s) => ({ serviceId: s.id, name: s.name, price: s.price, duration: s.duration })), payment: input.payment, paid: input.payment === 'online', source: 'online',
        bookingNo: res.data.bookingNo,
      };
      return { ok: true, booking };
    } catch (e) {
      void this.refreshBusy();
      return { ok: false, error: callableMessage(e) };
    }
  }

  /** Owner adds an appointment from the calendar. */
  async addOwnerBooking(b: {
    date: string; staffId: string; serviceIds: string[]; start: number; client: string; phone: string; notes?: string; duration?: number;
  }): Promise<{ ok: boolean; error?: string }> {
    const error = this.checkBooking(b.date, b.staffId, b.start, b.duration ?? b.serviceIds.reduce((a, id) => a + (this.serviceById(id)?.duration ?? 0), 0));
    if (error) return { ok: false, error };
    try {
      await httpsCallable(this.fns(), 'createOwnerBooking')({
        salonId: this.salonId(), requestId: crypto.randomUUID(), serviceIds: b.serviceIds, staffId: b.staffId, date: b.date, start: b.start,
        customerName: b.client, customerPhone: b.phone.replace(/\D/g, '').slice(-10), notes: b.notes, duration: b.duration,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: callableMessage(e) };
    }
  }

  /** Runs a booking change on the server. Returns the error text, or null on success. */
  async changeBooking(id: string, action: 'cancel' | 'reschedule' | 'start' | 'complete' | 'no-show' | 'delay' | 'addon', extra: Record<string, unknown> = {}, salonId = this.salonId()): Promise<string | null> {
    try {
      await httpsCallable(this.fns(), 'changeBooking')({ salonId, bookingId: id, action, ...extra });
      if (this.mode() === 'public') void this.refreshBusy();
      return null;
    } catch (e) {
      return callableMessage(e);
    }
  }

  cancelBooking(id: string, salonId?: string) {
    return this.changeBooking(id, 'cancel', {}, salonId);
  }
  rescheduleBooking(id: string, date: string, start: number, salonId?: string) {
    return this.changeBooking(id, 'reschedule', { date, start }, salonId);
  }
  startBooking(id: string) {
    return this.changeBooking(id, 'start');
  }
  completeBooking(id: string) {
    return this.changeBooking(id, 'complete');
  }
  markNoShow(id: string) {
    return this.changeBooking(id, 'no-show');
  }
  delayBooking(id: string, minutes: number) {
    return this.changeBooking(id, 'delay', { minutes });
  }
  addOnService(id: string, serviceId: string) {
    return this.changeBooking(id, 'addon', { serviceId });
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
        .filter((x) => x.staffId === s.id && x.status !== 'no-show')
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
    if (!s || this.mode() !== 'owner') return;
    void this.write(
      addDoc(this.col('queue'), {
        stage: 'waiting', client, phone: phone || 'Walk-in', service: s.name, category: s.category, price: s.price, duration: s.duration,
        requestedStaffId: staffId, staffId: null, station: null, source: 'walkin', arrivedAt: this.nowMin(), startedAt: null,
        date: dateKey(new Date()), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }),
      'Could not add the client to the queue.',
    );
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
    void this.write(updateDoc(doc(this.fb.db, `salons/${this.salonId()}/queue/${id}`), { stage: 'in-chair', staffId: pick.id, station, startedAt: this.nowMin(), updatedAt: serverTimestamp() }), 'Could not seat the client.');
    return null;
  }

  // ---------- billing ----------
  /** Next invoice number to expect. Display only: the server issues the real one, race-free. */
  nextInvoiceNo() {
    const d = new Date();
    const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    const fy = `${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
    const prefix = `CH/${fy}/`;
    const last = this.bills().reduce((m, b) => (b.no.startsWith(prefix) ? Math.max(m, Number(b.no.slice(prefix.length)) || 0) : m), 0);
    return `${prefix}${String(last + 1).padStart(5, '0')}`;
  }

  /** Prices are GST-inclusive. The server issues the invoice number and updates the queue, booking and customer record. */
  async createBill(input: {
    client: string; phone: string; lines: BillLine[]; discount: number; couponCode?: string; method: PayMethod; queueId?: string | null; bookingId?: string | null;
  }): Promise<Bill> {
    const subtotal = input.lines.reduce((a, l) => a + l.price * l.qty, 0);
    const discount = clampDiscount(subtotal, input.discount);
    const res = await httpsCallable<Record<string, unknown>, Record<string, unknown>>(this.fns(), 'createBill')({
      salonId: this.salonId(), client: input.client, phone: input.phone, lines: input.lines, discount, couponCode: input.couponCode, method: input.method,
      queueId: input.queueId ?? null, bookingId: input.bookingId ?? null,
    });
    const r = res.data;
    const { gstRegistered, gstin } = this.settings();
    const tax = splitGst(subtotal - discount, gstRegistered);
    return {
      no: r['no'] as string, client: input.client, phone: input.phone, lines: input.lines, subtotal, discount, couponCode: input.couponCode, taxable: tax.taxable, cgst: tax.cgst,
      sgst: tax.sgst, gst: tax.gst, gstRegistered, gstin: gstRegistered ? gstin : undefined, total: subtotal - discount, method: input.method, createdAt: r['createdAt'] as string,
    };
  }

  // ---------- coupons (fixed codes until per-salon coupon management is built) ----------
  applyCoupon(code: string, subtotal: number): { ok: true; discount: number; label: string } | { ok: false } {
    const c = COUPONS[code.trim().toUpperCase()];
    if (!c) return { ok: false };
    const discount = c.type === 'percent' ? Math.round((subtotal * c.value) / 100) : Math.min(c.value, subtotal);
    return { ok: true, discount, label: c.label };
  }

  // ---------- customers ----------
  /** Owner: this salon's record of the customer. Customer: their own count, loaded by `loadMyRecord`. */
  noShowsOf(phone: string) {
    if (this.mode() === 'public') return this.myNoShows();
    const k = phoneKey(phone);
    return k ? this.customers().find((c) => c.id === `p_${k}`)?.noShowCount ?? 0 : 0;
  }

  /** Reads the signed-in customer's own record at this salon (the rules only allow that one). */
  async loadMyRecord(phone: string) {
    const id = this.salonId();
    const key = customerKey(phone);
    if (!id || !phoneKey(phone)) return;
    try {
      const snap = await getDoc(doc(this.fb.db, `salons/${id}/customers/${key}`));
      this.myNoShows.set(snap.exists() ? snap.get('noShowCount') ?? 0 : 0);
    } catch {
      this.myNoShows.set(0); // no record yet, or not linked to this login
    }
  }
}
