import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Booking } from '../../../core/models';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { UiService } from '../../../core/services/ui.service';
import { dateKey, fmt12, inr, initials, toMin } from '../../../core/utils/time';
import { Topbar } from '../../../shared/layout/topbar';
import { BTN_GHOST } from '../../../shared/ui/form-classes';
import { Modal } from '../../../shared/ui/modal';

const PX_PER_MIN = 1.6; // 48px per 30-minute row
const STATUS_LABEL: Record<Booking['status'], string> = { 'in-progress': 'In Progress', completed: 'Completed', confirmed: 'Confirmed', vip: 'VIP Slot', cancelled: 'Cancelled' };

@Component({
  selector: 'app-calendar',
  imports: [FormsModule, Topbar, Modal],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-3 md:gap-5">
        <div class="flex items-center gap-1 md:gap-2 bg-surface-container-low px-2 md:px-3 py-1.5 rounded-lg border border-outline-variant/30">
          <button type="button" aria-label="Previous day" (click)="shift(-1)" class="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container-lowest transition-colors active:scale-95"><span class="material-symbols-outlined text-[18px]">chevron_left</span></button>
          <div class="flex items-center gap-2 px-1"><span class="material-symbols-outlined text-[18px] text-primary hidden sm:inline">calendar_month</span><span class="font-headline-sm text-headline-sm text-on-surface whitespace-nowrap">{{ dateLabel() }}</span></div>
          <button type="button" aria-label="Next day" (click)="shift(1)" class="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container-lowest transition-colors active:scale-95"><span class="material-symbols-outlined text-[18px]">chevron_right</span></button>
        </div>
        @if (!isToday()) { <button type="button" (click)="goToday()" class="hidden sm:block text-label-md font-label-md text-primary hover:underline">Today</button> }
        <div class="hidden md:flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant/30">
          <button type="button" class="px-3 py-1 rounded bg-surface-container-lowest font-label-md text-label-md text-primary font-semibold shadow-xs">Day</button>
          <button type="button" (click)="toast.info('Week view arrives in a later phase')" class="px-3 py-1 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface">Week</button>
          <button type="button" (click)="toast.info('Month view arrives in a later phase')" class="px-3 py-1 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface">Month</button>
        </div>
        <div class="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-primary/10 rounded-full"><span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span><span class="font-label-sm text-label-sm text-primary">Live Floor Sync</span></div>
      </div>
      <ng-container right>
        <div class="relative hidden lg:block w-48">
          <span class="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-outline">search</span>
          <input type="text" class="w-full pl-8 pr-3 py-1.5 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-sm font-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" placeholder="Search booking..." aria-label="Search bookings" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <button type="button" (click)="ui.walkInModal.set(true)" class="hidden sm:flex px-3.5 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/5 font-label-lg text-label-lg transition-colors items-center gap-1.5 active:scale-95"><span class="material-symbols-outlined text-[18px]">person_add</span><span>Add Walk-in</span></button>
        <button type="button" (click)="ui.openBooking({ date: dateStr() })" class="px-4 py-1.5 rounded-lg bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary font-label-lg text-label-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"><span class="material-symbols-outlined text-[18px]">add</span><span class="hidden sm:inline">New Booking</span></button>
        <button type="button" class="hidden md:block p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors" title="Help" (click)="toast.info('Click any empty slot to create a booking')"><span class="material-symbols-outlined text-[20px]">help</span></button>
      </ng-container>
    </app-topbar>

    <main class="lg:pl-64 pt-16 min-h-screen flex flex-col xl:flex-row bg-surface">
      <section class="flex-1 min-w-0 flex flex-col xl:border-r border-outline-variant/30 overflow-hidden">
        <div class="p-4 bg-surface-container-lowest border-b border-outline-variant/30 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <span class="font-headline-sm text-headline-sm text-on-surface">Staff on Duty ({{ working().length }})</span>
            <span class="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">{{ dayBookings().length }} Total Slots Booked</span>
          </div>
        </div>

        <div class="overflow-x-auto custom-scrollbar">
          <div [style.min-width.px]="80 + store.staff().length * 190">
            <div class="grid bg-surface-container-lowest border-b border-outline-variant/40 shadow-xs z-20 relative" [style.grid-template-columns]="cols()">
              <div class="py-3 px-2 border-r border-outline-variant/30 flex items-center justify-center font-label-sm text-label-sm text-outline">Time (IST)</div>
              @for (s of store.staff(); track s.id) {
                <div class="@container p-3 border-r border-outline-variant/30 flex items-center justify-between gap-2" [class.opacity-50]="!works(s.id)">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="relative shrink-0">
                      @if (s.photo) { <img class="w-9 h-9 rounded-full object-cover border border-primary/20" [src]="s.photo" [alt]="s.name" /> }
                      @else { <div class="w-9 h-9 rounded-full border border-primary/20 bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-label-md">{{ initials(s.name) }}</div> }
                      <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white" [class]="works(s.id) ? 'bg-primary' : 'bg-outline'"></span>
                    </div>
                    <div class="min-w-0"><p class="font-headline-sm text-headline-sm text-on-surface leading-tight truncate">{{ s.name }}</p><p class="font-label-sm text-label-sm text-outline truncate">{{ works(s.id) ? s.role : 'Off today' }}</p></div>
                  </div>
                  <span class="hidden @[230px]:inline-block px-2 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-label-sm shrink-0">{{ countFor(s.id) }} appts</span>
                </div>
              }
            </div>

            <div class="overflow-y-auto max-h-[calc(100vh-240px)] relative custom-scrollbar">
              <div class="grid relative" [style.grid-template-columns]="cols()" [style.height.px]="height()">
                <div class="border-r border-outline-variant/30 bg-surface-container-lowest select-none">
                  @for (r of rows(); track r.min) {
                    <div class="h-12 border-b border-outline-variant/20 px-2 py-1 text-right text-outline" [class]="r.hour ? 'font-label-sm text-label-sm font-medium' : 'font-body-sm text-[10px] opacity-70'">{{ fmt(r.min) }}</div>
                  }
                </div>

                @for (s of store.staff(); track s.id) {
                  <div class="relative border-r border-outline-variant/20 transition-colors" [class]="works(s.id) ? 'bg-surface/40 hover:bg-surface-bright cursor-pointer' : 'bg-surface-container-low/60 diagonal-stripes'" (click)="clickColumn($event, s.id)" [attr.aria-label]="'Schedule for ' + s.name">
                    <div class="absolute inset-0 flex flex-col pointer-events-none">
                      @for (r of rows(); track r.min) { <div class="h-12 border-b border-outline-variant/15"></div> }
                    </div>

                    @if (!works(s.id)) {
                      <div class="absolute inset-x-2 top-4 text-center text-label-md font-label-md text-tertiary">Not working today</div>
                    } @else {
                      @if (breakBlock(); as b) {
                        <div class="absolute left-2 right-2 rounded-xl px-3 diagonal-stripes bg-surface-container-high/60 border border-outline-variant/40 flex items-center justify-center text-center z-10 pointer-events-none" [style.top.px]="b.top" [style.height.px]="b.height">
                          <span class="font-label-md text-label-md text-tertiary flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">restaurant</span> Lunch Break</span>
                        </div>
                      }
                      @for (bk of bookingsOf(s.id); track bk.id) {
                        <button type="button" (click)="open(bk); $event.stopPropagation()" class="absolute left-2 right-2 rounded-xl p-3 bg-surface-container-lowest shadow-sm hover:shadow-md transition-all cursor-pointer group z-10 flex flex-col justify-between text-left overflow-hidden"
                          [class]="((bk.status === 'vip' || bk.vip) ? 'border-2 border-secondary-container ring-2 ring-secondary-container/10 shadow-md' : 'border-l-4 border-primary') + (dim(bk) ? ' opacity-30' : '')"
                          [style.top.px]="top(bk)" [style.height.px]="hgt(bk)">
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                              <span class="font-headline-sm text-[14px] text-on-surface font-semibold group-hover:text-primary transition-colors">{{ bk.client }}</span>
                              <span class="px-2 py-0.5 rounded-full font-label-sm text-[10px] font-bold shrink-0" [class]="(bk.status === 'vip' || bk.vip) ? 'bg-secondary-container text-on-secondary-container uppercase tracking-wider' : 'bg-primary/10 text-primary'">{{ label(bk.status) }}</span>
                            </div>
                            <p class="font-label-md text-label-md mt-0.5 truncate" [class]="(bk.status === 'vip' || bk.vip) ? 'text-secondary font-semibold' : 'text-primary'">{{ bk.serviceName }}</p>
                            @if (hgt(bk) >= 100) {
                              <p class="font-body-sm text-body-sm text-outline flex items-center gap-1 mt-1"><span class="material-symbols-outlined text-[14px]">call</span> {{ bk.phone }}</p>
                            }
                            @if (hgt(bk) >= 150 && bk.notes) {
                              <p class="font-body-sm text-[11px] text-on-surface-variant mt-1 bg-surface-container-low p-1.5 rounded line-clamp-2">{{ bk.notes }}</p>
                            }
                          </div>
                          <div class="flex items-center justify-between pt-1.5 border-t border-outline-variant/20">
                            <span class="font-headline-sm text-headline-sm" [class]="(bk.status === 'vip' || bk.vip) ? 'text-secondary font-bold' : 'text-on-surface'">{{ inr(bk.price) }}</span>
                            <span class="px-1.5 py-0.5 rounded bg-surface-container font-label-sm text-[10px] text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">schedule</span> {{ bk.duration }}m</span>
                          </div>
                        </button>
                      }
                    }
                  </div>
                }

                @if (nowTop() !== null) {
                  <div class="absolute left-0 right-0 z-20 pointer-events-none flex items-center" [style.top.px]="nowTop()">
                    <span class="w-2.5 h-2.5 rounded-full bg-secondary -ml-1"></span><div class="flex-1 h-px bg-secondary"></div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="w-full xl:w-80 bg-surface-container-lowest p-5 flex flex-col gap-6 xl:overflow-y-auto border-t xl:border-t-0 border-outline-variant/30">
        <div class="bg-surface-container-low/60 p-4 rounded-xl border border-outline-variant/30">
          <div class="flex items-center justify-between mb-3">
            <span class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ monthLabel() }}</span>
            <div class="flex items-center gap-1">
              <button type="button" aria-label="Previous month" (click)="shiftMonth(-1)" class="p-1 rounded hover:bg-surface-container text-outline"><span class="material-symbols-outlined text-[16px]">chevron_left</span></button>
              <button type="button" aria-label="Next month" (click)="shiftMonth(1)" class="p-1 rounded hover:bg-surface-container text-outline"><span class="material-symbols-outlined text-[16px]">chevron_right</span></button>
            </div>
          </div>
          <div class="grid grid-cols-7 text-center font-label-sm text-[11px] text-outline mb-2">
            @for (d of ['Su','Mo','Tu','We','Th','Fr','Sa']; track d) { <span>{{ d }}</span> }
          </div>
          <div class="grid grid-cols-7 text-center font-body-sm text-body-sm gap-y-1.5">
            @for (c of monthCells(); track c.key) {
              <button type="button" (click)="pick(c.date)" class="py-1 rounded transition-colors" [class]="c.selected ? 'bg-primary text-on-primary font-bold rounded-lg shadow-sm' : c.other ? 'text-outline/40 hover:bg-surface-container' : c.today ? 'text-primary font-bold hover:bg-surface-container' : 'hover:bg-surface-container'">{{ c.date.getDate() }}</button>
            }
          </div>
        </div>

        <div class="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/30">
          <div class="flex items-center justify-between mb-2">
            <span class="font-headline-sm text-headline-sm text-on-surface">Chair Occupancy</span>
            <span class="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold font-label-md text-label-md">{{ occupancy() >= 80 ? 'Peak Load' : 'Steady' }}</span>
          </div>
          <div class="flex items-end gap-3 my-2"><span class="font-headline-xl text-headline-xl text-primary font-extrabold leading-none">{{ occupancy() }}%</span><span class="font-body-sm text-body-sm text-outline pb-1">{{ working().length }} stylists on duty</span></div>
          <div class="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden mb-3"><div class="bg-primary h-full rounded-full transition-all duration-500" [style.width.%]="occupancy()"></div></div>
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/20 text-[12px]">
            <div class="flex items-center gap-1.5 text-on-surface-variant"><span class="w-2 h-2 rounded-full bg-primary"></span><span>Buffer: {{ store.buffer() }}m</span></div>
            <div class="flex items-center gap-1.5 text-on-surface-variant"><span class="w-2 h-2 rounded-full bg-secondary-container"></span><span>Walk-ins: {{ queued() }} queued</span></div>
          </div>
        </div>

        <div class="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/30 flex flex-col gap-3">
          <div class="flex items-center justify-between"><span class="font-headline-sm text-headline-sm text-on-surface">Quick Slot Finder</span><span class="material-symbols-outlined text-[18px] text-primary">bolt</span></div>
          <p class="font-body-sm text-body-sm text-outline">Rapid availability for 45m+ urgent walk-ins:</p>
          <div class="flex flex-col gap-2">
            @for (f of freeSlots(); track f.staffId + f.start) {
              <button type="button" (click)="ui.openBooking({ date: dateStr(), staffId: f.staffId, start: f.start })" class="p-2.5 rounded-lg border border-primary/40 bg-surface-container-lowest hover:bg-primary/5 text-left transition-all flex items-center justify-between group">
                <div><p class="font-label-md text-label-md text-primary font-semibold">{{ fmt(f.start) }} - {{ fmt(f.end) }}</p><p class="font-body-sm text-body-sm text-outline">{{ store.staffById(f.staffId)?.name }}</p></div>
                <span class="material-symbols-outlined text-[18px] text-primary group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
              </button>
            } @empty {
              <p class="text-body-sm text-outline py-2">No open slots of 45 min or more.</p>
            }
          </div>
        </div>

        @if (vipCount() > 0) {
          <div class="p-3.5 rounded-xl bg-secondary-fixed/50 border border-secondary-container/30 flex items-start gap-2.5">
            <span class="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">notification_important</span>
            <div><p class="font-label-md text-label-md text-on-secondary-fixed font-bold">VIP guests today</p><p class="font-body-sm text-body-sm text-on-secondary-fixed-variant mt-0.5">{{ vipCount() }} VIP booking{{ vipCount() > 1 ? 's' : '' }} scheduled. Keep their stations ready.</p></div>
          </div>
        }
      </aside>
    </main>

    <app-modal [open]="selected() !== null" title="Appointment" (closed)="selected.set(null)">
      @if (selected(); as b) {
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div><h4 class="font-headline-md text-headline-md text-on-surface">{{ b.client }}</h4><p class="text-body-sm text-outline">{{ b.phone }}</p></div>
            <span class="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-bold">{{ label(b.status) }}</span>
          </div>
          <dl class="grid grid-cols-2 gap-3 text-body-md">
            <div><dt class="text-label-sm text-outline">Service</dt><dd class="font-semibold text-on-surface">{{ b.serviceName }}</dd></div>
            <div><dt class="text-label-sm text-outline">Stylist</dt><dd class="font-semibold text-on-surface">{{ store.staffById(b.staffId)?.name }}</dd></div>
            <div><dt class="text-label-sm text-outline">Time</dt><dd class="font-semibold text-on-surface">{{ fmt(b.start) }} - {{ fmt(b.start + b.duration) }}</dd></div>
            <div><dt class="text-label-sm text-outline">Amount</dt><dd class="font-semibold text-on-surface">{{ inr(b.price) }}</dd></div>
          </dl>
          @if (b.notes) { <p class="text-body-sm bg-surface-container-low p-2 rounded">{{ b.notes }}</p> }
          <div class="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-outline-variant/20">
            <button type="button" [class]="ghost + ' text-error!'" (click)="cancelBooking(b)">Cancel booking</button>
            @if (b.status !== 'in-progress' && b.status !== 'completed') {
              <button type="button" class="px-4 py-2 rounded-lg text-label-md font-label-md border border-primary text-primary hover:bg-primary/5" (click)="setStatus(b, 'in-progress')">Start service</button>
            }
            @if (b.status !== 'completed') {
              <button type="button" class="px-4 py-2 rounded-lg text-label-md font-label-md bg-primary text-on-primary hover:bg-primary-container font-semibold" (click)="setStatus(b, 'completed')">Mark completed</button>
            }
          </div>
        </div>
      }
    </app-modal>
  `,
})
export class CalendarPage {
  protected readonly store = inject(SalonStore);
  protected readonly toast = inject(ToastService);
  protected readonly ui = inject(UiService);
  protected readonly inr = inr;
  protected readonly fmt = fmt12;
  protected readonly initials = initials;
  protected readonly ghost = BTN_GHOST;

  protected readonly date = signal(new Date());
  protected readonly viewMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly search = signal('');
  protected readonly selected = signal<Booking | null>(null);

  protected readonly dateStr = computed(() => dateKey(this.date()));
  protected readonly isToday = computed(() => this.dateStr() === dateKey(new Date()));
  protected readonly dateLabel = computed(() => (this.isToday() ? 'Today, ' : this.date().toLocaleDateString('en-IN', { weekday: 'short' }) + ', ') + this.date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
  protected readonly monthLabel = computed(() => this.viewMonth().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));

  protected readonly range = computed(() => {
    const t = this.store.dayTiming(this.dateStr());
    const s = t.open ? Math.floor(toMin(t.start) / 60) * 60 : 540;
    const e = t.open ? Math.ceil(toMin(t.end) / 60) * 60 : 1260;
    return { start: s, end: e };
  });
  protected readonly rows = computed(() => {
    const { start, end } = this.range();
    const out: { min: number; hour: boolean }[] = [];
    for (let m = start; m < end; m += 30) out.push({ min: m, hour: m % 60 === 0 });
    return out;
  });
  protected readonly height = computed(() => this.rows().length * 48);
  protected readonly cols = computed(() => `80px repeat(${this.store.staff().length}, minmax(180px, 1fr))`);

  protected readonly dayBookings = computed(() => this.store.bookingsFor(this.dateStr()));
  protected readonly working = computed(() => this.store.staff().filter((s) => this.store.staffWorks(s.id, this.dateStr())));
  protected readonly vipCount = computed(() => this.dayBookings().filter((b) => (b.status === 'vip' || b.vip)).length);
  protected readonly queued = computed(() => (this.isToday() ? this.store.queue().filter((q) => q.stage === 'waiting').length : 0));
  protected readonly occupancy = computed(() => {
    const t = this.store.dayTiming(this.dateStr());
    if (!t.open || !this.working().length) return 0;
    const brk = this.store.brk();
    const breakLen = brk.enabled && brk.blockSlots ? Math.max(0, toMin(brk.end) - toMin(brk.start)) : 0;
    const capacity = this.working().length * (toMin(t.end) - toMin(t.start) - breakLen);
    const booked = this.dayBookings().filter((b) => this.working().some((w) => w.id === b.staffId)).reduce((a, b) => a + b.duration, 0);
    return Math.min(100, Math.round((booked / Math.max(1, capacity)) * 100));
  });
  protected readonly freeSlots = computed(() => this.store.freeSlots(this.dateStr(), 45).slice(0, 3));
  protected readonly breakBlock = computed(() => {
    const b = this.store.brk();
    if (!b.enabled || !b.blockSlots) return null;
    const s = toMin(b.start);
    const e = toMin(b.end);
    if (e <= s || s < this.range().start || e > this.range().end) return null;
    return { top: (s - this.range().start) * PX_PER_MIN + 2, height: (e - s) * PX_PER_MIN - 4 };
  });
  protected readonly nowTop = computed(() => {
    if (!this.isToday()) return null;
    const n = this.store.nowMin();
    const { start, end } = this.range();
    return n >= start && n <= end ? (n - start) * PX_PER_MIN : null;
  });
  protected readonly monthCells = computed(() => {
    const first = this.viewMonth();
    const lead = first.getDay();
    const sel = this.dateStr();
    const today = dateKey(new Date());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first.getFullYear(), first.getMonth(), 1 - lead + i);
      const key = dateKey(d);
      return { date: d, key, other: d.getMonth() !== first.getMonth(), selected: key === sel, today: key === today };
    }).filter((c, i) => i < 35 || !c.other);
  });

  works(id: string) {
    return this.store.staffWorks(id, this.dateStr());
  }
  countFor(id: string) {
    return this.dayBookings().filter((b) => b.staffId === id).length;
  }
  bookingsOf(id: string) {
    return this.dayBookings().filter((b) => b.staffId === id);
  }
  top(b: Booking) {
    return (b.start - this.range().start) * PX_PER_MIN + 2;
  }
  hgt(b: Booking) {
    return b.duration * PX_PER_MIN - 4;
  }
  label(s: Booking['status']) {
    return STATUS_LABEL[s];
  }
  dim(b: Booking) {
    const q = this.search().trim().toLowerCase();
    return !!q && !b.client.toLowerCase().includes(q) && !b.serviceName.toLowerCase().includes(q);
  }

  shift(days: number) {
    const d = new Date(this.date());
    d.setDate(d.getDate() + days);
    this.pick(d);
  }
  goToday() {
    this.pick(new Date());
  }
  pick(d: Date) {
    this.date.set(d);
    this.viewMonth.set(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  shiftMonth(n: number) {
    const v = this.viewMonth();
    this.viewMonth.set(new Date(v.getFullYear(), v.getMonth() + n, 1));
  }

  clickColumn(e: MouseEvent, staffId: string) {
    if (!this.works(staffId)) return;
    const y = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    const min = this.range().start + Math.floor(y / PX_PER_MIN / 15) * 15;
    this.ui.openBooking({ date: this.dateStr(), staffId, start: min });
  }

  open(b: Booking) {
    this.selected.set(b);
  }
  setStatus(b: Booking, status: Booking['status']) {
    this.store.updateBooking(b.id, { status });
    this.selected.set(null);
    this.toast.success(`${b.client}: ${STATUS_LABEL[status].toLowerCase()}`);
  }
  cancelBooking(b: Booking) {
    this.store.removeBooking(b.id);
    this.selected.set(null);
    this.toast.info(`Booking for ${b.client} cancelled`);
  }
}
