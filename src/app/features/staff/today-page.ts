import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Booking } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { dateKey, fmt12, initials, inr, toMin, LOCALE } from '../../core/utils/time';
import { tr } from '../../core/utils/i18n';
import { Modal } from '../../shared/ui/modal';

type Filter = 'all' | 'active' | 'upcoming' | 'completed';

@Component({
  selector: 'app-staff-today',
  imports: [TranslatePipe, Modal],
  template: `
    <main class="w-full px-margin-mobile pt-space-md flex-1 flex flex-col gap-space-md">
      <section class="flex flex-col gap-space-sm">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5"><span class="font-label-sm text-label-sm text-primary font-semibold tracking-wide uppercase">{{ "Stylist Desk" | translate }}</span><span class="text-outline-variant text-xs">•</span><span class="font-label-sm text-label-sm text-on-surface-variant truncate">{{ (me()?.title || me()?.role) | translate }}</span></div>
            <h2 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold tracking-tight">{{ greeting() | translate }}, {{ firstName() }}</h2>
          </div>
          <div class="bg-surface-container-lowest border border-outline-variant/70 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm shrink-0"><span class="material-symbols-outlined text-primary text-sm">calendar_today</span><span class="font-label-md text-label-md text-on-surface font-semibold">{{ dateLabel() }}</span></div>
        </div>

        <div class="grid grid-cols-3 gap-2.5 pt-1">
          <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-level-1 flex flex-col justify-between">
            <div class="flex items-center justify-between text-on-surface-variant"><span class="font-label-sm text-label-sm">{{ 'staff.bookings' | translate }}</span><span class="material-symbols-outlined text-sm text-primary">calendar_month</span></div>
            <div class="mt-2"><span class="font-numeric-stat text-2xl font-bold text-on-surface leading-none">{{ mine().length }}</span><span class="font-label-sm text-label-sm text-on-surface-variant ml-0.5">{{ "today" | translate }}</span></div>
            <div class="w-full bg-surface-container-high h-1 rounded-full mt-2 overflow-hidden"><div class="bg-primary h-full rounded-full transition-all" [style.width.%]="doneShare()"></div></div>
          </div>
          <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-level-1 flex flex-col justify-between">
            <div class="flex items-center justify-between text-on-surface-variant"><span class="font-label-sm text-label-sm">{{ 'staff.chairTime' | translate }}</span><span class="material-symbols-outlined text-sm text-primary">schedule</span></div>
            <div class="mt-2"><span class="font-numeric-stat text-2xl font-bold text-on-surface leading-none">{{ chairHours() }}</span><span class="font-label-sm text-label-sm text-on-surface-variant ml-0.5">{{ "hrs" | translate }}</span></div>
            <p class="font-label-sm text-label-sm text-outline mt-1.5 truncate">{{ "Max {{p1}} hrs" | translate: { p1: (maxHours()) } }}</p>
          </div>
          <div class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-level-1 flex flex-col justify-between">
            <div class="flex items-center justify-between text-on-surface-variant"><span class="font-label-sm text-label-sm">{{ 'staff.projected' | translate }}</span><span class="material-symbols-outlined text-sm text-tertiary">payments</span></div>
            <div class="mt-2"><span class="font-numeric-stat text-xl font-bold text-tertiary leading-none">{{ inr(projected()) }}</span></div>
            <p class="font-label-sm text-label-sm text-tertiary font-medium mt-1.5">{{ "{{p1}}% commission" | translate: { p1: (me()?.commission) } }}</p>
          </div>
        </div>
      </section>

      <nav [attr.aria-label]="'Schedule Filters' | translate" class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        @for (f of filters; track f.key) {
          <button type="button" (click)="filter.set(f.key)" class="px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all active:scale-95 duration-150 flex items-center gap-1.5" [class]="filter() === f.key ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'bg-surface-container-lowest border border-outline-variant/80 text-on-surface-variant hover:border-primary hover:text-primary font-medium'">
            @if (f.key === 'active') { <span class="w-2 h-2 rounded-full bg-primary" [class.animate-ping]="filter() !== 'active' && counts()[f.key] > 0"></span> }
            {{ f.label | translate }} ({{ counts()[f.key] }})
          </button>
        }
      </nav>

      <div class="flex flex-col gap-space-md">
        @for (b of visible(); track b.id) {
          @if (b.status === 'in-progress') {
            <article class="bg-surface-container-lowest rounded-2xl border-2 border-primary shadow-level-2 p-4 relative overflow-hidden">
              <div class="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-primary to-primary-container"></div>
              <div class="flex items-center justify-between pb-3 border-b border-outline-variant/40">
                <div class="flex items-center gap-2"><span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold"><span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span> {{ "IN PROGRESS" | translate }}</span></div>
                <div class="flex items-center gap-1 font-label-md text-label-md text-secondary font-bold bg-secondary-fixed/40 px-2 py-0.5 rounded-lg"><span class="material-symbols-outlined text-sm">timer</span><span>{{ left(b) }}</span></div>
              </div>
              <div class="pt-3 flex flex-col gap-2.5">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-3 min-w-0">
                    <div class="w-11 h-11 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-headline-sm font-bold border border-outline-variant/50 shrink-0">{{ initials(b.client) }}</div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5 flex-wrap"><h3 class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ b.client }}</h3>@if (b.vip) { <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold tracking-wider uppercase flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px] text-amber-700">workspace_premium</span> VIP</span> }</div>
                      <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 flex items-center gap-1"><span class="material-symbols-outlined text-xs text-outline">schedule</span> {{ "{{p1}} ({{p2}} mins)" | translate: { p1: (range(b)), p2: (b.duration) } }}</p>
                    </div>
                  </div>
                  <a [attr.aria-label]="'Call Client' | translate" class="w-9 h-9 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low text-primary flex items-center justify-center transition-colors active:scale-95 shrink-0" [href]="'tel:' + phone(b)"><span class="material-symbols-outlined text-base">call</span></a>
                </div>
                <div class="bg-surface-container-low/70 rounded-xl p-3 border border-outline-variant/50 flex items-center justify-between gap-2 mt-1">
                  <div class="flex flex-col min-w-0"><span class="font-label-md text-label-md text-on-surface font-semibold">{{ b.serviceName }}</span>@if (b.notes) { <span class="font-body-sm text-body-sm text-outline mt-0.5">{{ b.notes }}</span> }</div>
                  <span class="font-headline-sm text-headline-sm text-primary font-bold ml-2 shrink-0">{{ inr(b.price) }}</span>
                </div>
                <div class="grid grid-cols-2 gap-2.5 mt-2">
                  <button type="button" (click)="addOn.set(b)" class="h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface font-label-md text-label-md font-semibold hover:bg-surface-container-low transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"><span class="material-symbols-outlined text-base text-primary">add_circle</span><span>{{ 'staff.addOn' | translate }}</span></button>
                  <button type="button" (click)="done(b)" class="h-11 px-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold shadow-level-1 transition-all active:scale-95 flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-lg">check_circle</span><span>{{ 'staff.markDone' | translate }}</span></button>
                </div>
              </div>
            </article>
          } @else if (b.status === 'completed') {
            <article class="bg-surface-container-low/50 rounded-2xl border border-outline-variant/40 p-3.5 flex items-center justify-between opacity-85 gap-2">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-outline text-sm font-bold shrink-0">{{ initials(b.client) }}</div>
                <div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><h4 class="font-headline-sm text-headline-sm text-on-surface font-medium">{{ b.client }}</h4><span class="px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary text-[11px] font-semibold flex items-center gap-1"><span class="material-symbols-outlined text-xs">check</span> {{ "Completed" | translate }}</span></div><p class="font-body-sm text-body-sm text-outline mt-0.5">{{ range(b) }} · {{ b.paid ? ('Paid {{p1}}' | translate: { p1: inr(b.price) }) : ('{{p1}} due' | translate: { p1: inr(b.price) }) }}</p></div>
              </div>
              <button type="button" [attr.aria-label]="'View Receipt' | translate" (click)="toast.info('Receipt for {{p1}}: {{p2}}', { p1: b.client, p2: inr(b.price) })" class="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"><span class="material-symbols-outlined text-lg">receipt_long</span></button>
            </article>
          } @else if (b.id === nextId()) {
            <article class="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-level-1 p-4 flex flex-col gap-3 hover:border-primary/50 transition-all">
              <div class="flex items-center justify-between pb-2.5 border-b border-outline-variant/30 gap-2">
                <div class="flex items-center gap-2 flex-wrap"><span class="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-semibold">{{ "NEXT UP" | translate }}</span><span class="font-label-md text-label-md text-secondary font-semibold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-secondary"></span> {{ arriving(b) }}</span></div>
              </div>
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant font-headline-sm font-bold border border-outline-variant/50 shrink-0">{{ initials(b.client) }}</div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap"><h3 class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ b.client }}</h3>@if (b.paid && b.payment === 'online') { <span class="px-2 py-0.5 rounded-full bg-tertiary-fixed/40 text-tertiary text-[10px] font-bold flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">verified</span> {{ "Pre-paid Online" | translate }}</span> }</div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 flex items-center gap-1"><span class="material-symbols-outlined text-xs text-outline">schedule</span> {{ "{{p1}} ({{p2}} mins)" | translate: { p1: (range(b)), p2: (b.duration) } }}</p>
                  </div>
                </div>
                <a [attr.aria-label]="'Call Client' | translate" class="w-8 h-8 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container-low text-primary flex items-center justify-center transition-colors active:scale-95 shrink-0" [href]="'tel:' + phone(b)"><span class="material-symbols-outlined text-sm">call</span></a>
              </div>
              <div class="flex items-center justify-between bg-surface-container-low/40 rounded-xl px-3 py-2 border border-outline-variant/40 gap-2"><div class="min-w-0"><span class="font-label-md text-label-md text-on-surface font-medium">{{ b.serviceName }}</span>@if (b.notes) { <span class="font-body-sm text-body-sm text-outline block">{{ b.notes }}</span> }</div><span class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ inr(b.price) }}</span></div>
              <div class="grid grid-cols-2 gap-2.5 pt-0.5">
                <button type="button" (click)="delay(b)" class="h-11 px-3 rounded-xl border border-outline-variant bg-surface text-on-surface-variant font-label-md text-label-md font-semibold hover:border-secondary hover:text-secondary transition-all active:scale-95 flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-base">more_time</span><span>{{ 'staff.delay' | translate }}</span></button>
                <button type="button" (click)="start(b)" class="h-11 px-3 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md font-bold shadow-sm hover:opacity-95 transition-all active:scale-95 flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-base">play_arrow</span><span>{{ 'staff.startService' | translate }}</span></button>
              </div>
            </article>
          } @else {
            <article class="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-level-1 p-4 flex flex-col gap-3">
              <div class="flex items-center justify-between pb-2 border-b border-outline-variant/20 gap-2"><div class="flex items-center gap-2 flex-wrap"><span class="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-medium uppercase">{{ period(b) }}</span><span class="font-label-sm text-label-sm text-outline">{{ range(b) }}</span></div><span class="px-2.5 py-0.5 rounded-full bg-tertiary-fixed/30 text-tertiary font-label-sm text-label-sm font-semibold">{{ "Confirmed" | translate }}</span></div>
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-3 min-w-0"><div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant font-headline-sm font-semibold border border-outline-variant/40 shrink-0">{{ initials(b.client) }}</div><div class="min-w-0"><h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold">{{ b.client }}</h3><p class="font-body-sm text-body-sm text-outline mt-0.5">{{ b.serviceName }}</p></div></div>
                <span class="font-headline-sm text-headline-sm text-on-surface font-semibold">{{ inr(b.price) }}</span>
              </div>
              <div class="flex items-center justify-between pt-1 text-on-surface-variant gap-2"><span class="font-body-sm text-body-sm text-outline flex items-center gap-1 min-w-0"><span class="material-symbols-outlined text-xs">info</span><span class="truncate">{{ expanded() === b.id ? phone(b) : (b.notes || ('No special requests' | translate)) }}</span></span><button type="button" (click)="expanded.set(expanded() === b.id ? null : b.id)" class="font-label-sm text-label-sm text-primary font-semibold hover:underline flex items-center gap-0.5 shrink-0">{{ "Details" | translate }} <span class="material-symbols-outlined text-xs">{{ expanded() === b.id ? 'expand_less' : 'chevron_right' }}</span></button></div>
            </article>
          }
        } @empty {
          <div class="text-center py-10 text-on-surface-variant flex flex-col items-center gap-2"><span class="material-symbols-outlined text-5xl text-primary/30">event_available</span><p class="text-body-md">{{ "Nothing here right now." | translate }}</p></div>
        }
      </div>
    </main>

    <app-modal [open]="addOn() !== null" [title]="'Add an add-on service' | translate" (closed)="addOn.set(null)">
      @if (addOn(); as b) {
        <div class="space-y-2">
          <p class="text-body-sm text-on-surface-variant mb-2">{{ "Extra service for" | translate }} <strong class="text-on-surface">{{ b.client }}</strong>{{ ". The price and time are added to this booking." | translate }}</p>
          @for (s of store.selectedServices(); track s.id) {
            <button type="button" (click)="doAddOn(b, s.id)" class="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-outline-variant/50 hover:border-primary hover:bg-primary/5 text-left transition-colors"><div><p class="font-label-lg text-label-lg text-on-surface">{{ s.name }}</p><p class="text-body-sm text-outline">{{ "{{p1}} mins" | translate: { p1: (s.duration) } }}</p></div><span class="font-headline-sm text-headline-sm text-primary">+{{ inr(s.price) }}</span></button>
          }
        </div>
      }
    </app-modal>
  `,
})
export class TodayPage {
  protected readonly store = inject(SalonStore);
  private readonly auth = inject(AuthService);
  protected readonly toast = inject(ToastService);
  protected readonly inr = inr;
  protected readonly initials = initials;
  protected readonly dateLabel = computed(() => new Date().toLocaleDateString(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' }));
  protected readonly filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'staff.all' }, { key: 'active', label: 'staff.active' }, { key: 'upcoming', label: 'staff.upcoming' }, { key: 'completed', label: 'staff.completed' },
  ];

  protected readonly filter = signal<Filter>('all');
  protected readonly addOn = signal<Booking | null>(null);
  protected readonly expanded = signal<string | null>(null);
  private readonly today = dateKey(new Date());

  protected readonly me = computed(() => this.store.staffById(this.auth.staffId()));
  protected readonly firstName = computed(() => this.me()?.name.split(' ')[0] ?? '');
  protected readonly greeting = computed(() => {
    const h = Math.floor(this.store.nowMin() / 60);
    return h < 12 ? 'staff.goodMorning' : h < 17 ? 'staff.goodAfternoon' : 'staff.goodEvening';
  });

  protected readonly mine = computed(() =>
    this.store.bookingsFor(this.today).filter((b) => b.staffId === this.auth.staffId()).sort((a, b) => a.start - b.start),
  );
  protected readonly counts = computed(() => {
    const m = this.mine();
    return {
      all: m.length,
      active: m.filter((b) => b.status === 'in-progress').length,
      upcoming: m.filter((b) => b.status === 'confirmed' || b.status === 'vip').length,
      completed: m.filter((b) => b.status === 'completed').length,
    };
  });
  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.mine().filter((b) =>
      f === 'all' ? true : f === 'active' ? b.status === 'in-progress' : f === 'completed' ? b.status === 'completed' : b.status === 'confirmed' || b.status === 'vip',
    );
  });
  protected readonly nextId = computed(() => this.mine().find((b) => b.status === 'confirmed' || b.status === 'vip')?.id);
  protected readonly doneShare = computed(() => (this.mine().length ? Math.round((this.counts().completed / this.mine().length) * 100) : 0));
  protected readonly chairHours = computed(() => Math.round((this.mine().reduce((a, b) => a + b.duration, 0) / 60) * 10) / 10);
  protected readonly maxHours = computed(() => {
    const t = this.store.dayTiming(this.today);
    const brk = this.store.brk();
    const breakLen = brk.enabled && brk.blockSlots ? toMin(brk.end) - toMin(brk.start) : 0;
    return Math.max(0, Math.round(((toMin(t.end) - toMin(t.start) - breakLen) / 60) * 10) / 10);
  });
  protected readonly projected = computed(() => {
    const pct = this.me()?.commission ?? 0;
    return Math.round(this.mine().reduce((a, b) => a + (b.price * pct) / 100, 0));
  });

  fmt(m: number) {
    return fmt12(m);
  }
  range(b: Booking) {
    return `${fmt12(b.start)} - ${fmt12(b.start + b.duration)}`;
  }
  phone(b: Booking) {
    return b.phone.replace(/[^\d+]/g, '');
  }
  period(b: Booking) {
    return tr(b.start < 12 * 60 ? 'Morning' : b.start < 17 * 60 ? 'Afternoon' : 'Evening');
  }
  left(b: Booking) {
    const l = b.start + b.duration - this.store.nowMin();
    return l > 0 ? tr('{{p1}}m left', { p1: l }) : tr('Overtime');
  }
  arriving(b: Booking) {
    const d = b.start - this.store.nowMin();
    return d > 0 ? tr('Arriving in {{p1}} mins', { p1: d }) : d > -10 ? tr('Due now') : tr('{{p1}} mins late', { p1: -d });
  }

  /** One server call at a time, so a double tap cannot start / finish a booking twice. */
  protected readonly pending = signal(false);
  private async act(job: () => Promise<string | null>, ok: () => void) {
    if (this.pending()) return;
    this.pending.set(true);
    const err = await job();
    this.pending.set(false);
    if (err) return this.toast.error(err);
    ok();
  }

  start(b: Booking) {
    return this.act(() => this.store.startBooking(b.id), () => this.toast.success('Started service for {{p1}}', { p1: b.client }));
  }
  done(b: Booking) {
    return this.act(() => this.store.completeBooking(b.id), () => this.toast.success('{{p1}} marked done. Send them to billing.', { p1: b.client }));
  }
  delay(b: Booking) {
    return this.act(() => this.store.delayBooking(b.id, 10), () => this.toast.info("{{p1}}'s slot moved 10 minutes later", { p1: b.client }));
  }
  doAddOn(b: Booking, serviceId: string) {
    return this.act(() => this.store.addOnService(b.id, serviceId), () => {
      this.addOn.set(null);
      this.toast.success('Add-on added to the booking');
    });
  }
}
