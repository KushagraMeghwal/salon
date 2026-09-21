import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AvailabilityService } from '../../core/services/availability.service';
import { AuthService } from '../../core/services/auth.service';
import { BookingFlowStore } from '../../core/services/booking-flow.store';
import { CustomerBookingsService } from '../../core/services/customer-bookings.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { fmt12, inr, LOCALE } from '../../core/utils/time';
import { StepBar } from '../../shared/customer/step-bar';

@Component({
  selector: 'app-customer-slot',
  imports: [StepBar, TranslatePipe],
  template: `
    <main class="flex-1 w-full max-w-screen-md mx-auto px-space-md pt-space-md pb-32">
      <div class="mb-space-md"><app-step-bar [step]="2" /></div>

      <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md mb-space-lg elevation-1 flex items-center justify-between gap-space-sm">
        <div class="flex items-center gap-space-sm min-w-0">
          <div class="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0 text-primary"><span class="material-symbols-outlined text-[22px]">spa</span></div>
          <div class="min-w-0">
            <h2 class="text-headline-sm font-headline-sm text-on-surface truncate">{{ names() }}</h2>
            <div class="flex items-center gap-space-xs mt-0.5 text-body-sm font-body-sm text-on-surface-variant"><span class="material-symbols-outlined text-[15px]">schedule</span><span>{{ "{{p1}} mins" | translate: { p1: (flow.totalDuration()) } }}</span><span class="text-outline-variant">•</span><span class="font-semibold text-on-surface">{{ inr(flow.totalPrice()) }}</span></div>
          </div>
        </div>
        <button type="button" (click)="changeServices()" class="text-label-sm font-label-sm text-primary hover:underline shrink-0 font-medium px-2 py-1">{{ 'common.change' | translate }}</button>
      </div>

      <section class="mb-space-xl">
        <div class="flex justify-between items-center mb-space-sm">
          <div class="flex items-center gap-space-xs"><span class="material-symbols-outlined text-primary text-[20px]">calendar_month</span><h3 class="text-headline-md font-headline-md text-on-surface font-bold">{{ 'slot.selectDate' | translate }}</h3></div>
          <span class="text-label-sm font-label-sm text-on-surface-variant font-medium">{{ monthLabel() }}</span>
        </div>
        <div class="flex gap-space-sm overflow-x-auto no-scrollbar py-space-xs -mx-space-md px-space-md">
          @for (d of days(); track d.key; let i = $index) {
            <button type="button" [disabled]="d.closed" (click)="pickDate(d.key)" [attr.aria-pressed]="date() === d.key" class="shrink-0 w-[78px] py-space-md px-space-xs rounded-xl flex flex-col items-center justify-center transition-all duration-150 relative disabled:cursor-not-allowed"
              [class]="date() === d.key ? 'bg-[#0F9D8A] text-white elevation-2 ring-2 ring-[#0F9D8A] ring-offset-2 active:scale-95' : d.closed ? 'bg-surface-container border border-dashed border-outline-variant text-outline opacity-70' : d.noStaff ? 'bg-surface-container-lowest border border-dashed border-outline-variant/70 text-on-surface-variant opacity-80 hover:border-[#0F9D8A] active:scale-95' : 'bg-surface-container-lowest border border-outline-variant hover:border-[#0F9D8A] hover:bg-surface-container-low elevation-1 active:scale-95'">
              @if (d.weekend && date() !== d.key && !d.closed && !d.noStaff) { <span class="absolute -top-2 bg-secondary-fixed text-on-secondary-fixed text-[9px] font-bold px-1.5 rounded-full uppercase tracking-tighter">{{ "Weekend" | translate }}</span> }
              @if (d.noStaff && date() !== d.key) { <span class="absolute -top-2 bg-surface-container-high text-on-surface-variant text-[9px] font-bold px-1.5 rounded-full uppercase tracking-tighter border border-outline-variant">{{ "No slots" | translate }}</span> }
              <span class="text-label-sm font-label-sm uppercase tracking-wider" [class]="date() === d.key ? 'opacity-90 font-bold' : 'text-on-surface-variant font-medium'">{{ i === 0 ? ('Today' | translate) : d.dow }}</span>
              <span class="text-headline-lg font-headline-lg my-0.5 font-bold leading-none" [class]="date() === d.key ? '' : 'text-on-surface'">{{ d.day }}</span>
              <span class="text-label-sm font-label-sm" [class]="date() === d.key ? 'opacity-90' : 'text-on-surface-variant'">{{ d.closed ? ('Closed' | translate) : d.month }}</span>
            </button>
          }
        </div>
      </section>

      <section class="space-y-space-lg">
        <div class="flex items-center justify-between">
          <h3 class="text-headline-md font-headline-md text-on-surface font-bold">{{ 'slot.selectTime' | translate }}</h3>
          <span class="text-label-sm font-label-sm text-primary flex items-center gap-1 font-semibold"><span class="material-symbols-outlined text-[14px]">schedule</span> {{ "IST (+05:30)" | translate }}</span>
        </div>

        @if (!store.bookable()) {
          <div class="rounded-xl border border-outline-variant bg-secondary-fixed/40 p-space-md text-body-md text-on-surface flex gap-2" role="status"><span class="material-symbols-outlined text-secondary">info</span><span>{{ "This salon is not taking online bookings right now. You can still call them." | translate }}</span></div>
        }
        @if (noStylist()) {
          <div class="rounded-xl border border-outline-variant bg-surface-container-low p-space-md text-body-md text-on-surface-variant flex gap-2"><span class="material-symbols-outlined text-primary">info</span><span>{{ "No single stylist offers all the selected services on this day. Try removing a service or pick another date." | translate }}</span></div>
        } @else if (!slots().length) {
          <div class="rounded-xl border border-outline-variant bg-surface-container-low p-space-md text-body-md text-on-surface-variant flex gap-2"><span class="material-symbols-outlined text-primary">event_busy</span><span>{{ holidayNote() }}</span></div>
        }

        @if (best(); as b) {
          <button type="button" (click)="flow.start.set(b.slot.start)" class="w-full text-left rounded-xl border-[1.5px] border-[#FF7A59]/50 bg-[#FFF4F0] p-space-md flex items-center gap-space-sm active:scale-[0.99] transition-transform">
            <div class="w-10 h-10 rounded-full bg-[#FF7A59] text-white flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[22px]">auto_awesome</span></div>
            <div class="min-w-0 flex-1">
              <p class="text-label-sm font-label-sm text-[#C2492B] font-bold uppercase tracking-wide">{{ "Best time for you" | translate }}</p>
              <p class="text-headline-sm font-headline-sm text-on-surface font-bold">{{ fmt(b.slot.start) }}</p>
              <p class="text-body-sm font-body-sm text-on-surface-variant">{{ b.reason | translate: { p1: fmt(b.pref ?? 0) } }}</p>
            </div>
            <span class="material-symbols-outlined text-[#C2492B]">{{ flow.start() === b.slot.start ? 'check_circle' : 'chevron_right' }}</span>
          </button>
        }

        @for (g of groups(); track g.key) {
          @if (g.slots.length) {
            <div class="bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant elevation-1">
              <div class="flex items-center gap-space-xs mb-space-md">
                <div class="p-1 rounded bg-[#E4F0F5] text-primary flex items-center justify-center"><span class="material-symbols-outlined text-[20px]">{{ g.icon }}</span></div>
                <div><h4 class="text-headline-sm font-headline-sm text-on-surface leading-tight font-semibold">{{ 'slot.' + g.key | translate }}</h4><p class="text-body-sm font-body-sm text-on-surface-variant">{{ (g.range) | translate }}</p></div>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                @for (s of g.slots; track s.start) {
                  @if (!s.staffIds.length) {
                    <button type="button" disabled class="py-space-sm px-space-sm rounded-lg bg-[#E5EBEB] border border-dashed border-[#8A9A9E] text-[#8A9A9E] text-center font-label-lg cursor-not-allowed opacity-70"><span class="line-through block">{{ fmt(s.start) }}</span><span class="block text-[10px] font-semibold uppercase tracking-wide no-underline">{{ "Booked" | translate }}</span></button>
                  } @else if (flow.start() === s.start) {
                    <button type="button" (click)="flow.start.set(null)" class="py-space-sm px-space-sm rounded-lg border-[1.5px] border-[#0F9D8A] bg-[#0F9D8A] text-white text-center font-label-lg font-semibold elevation-1 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ring-2 ring-[#0F9D8A] ring-offset-1"><span class="material-symbols-outlined text-[18px]">check_circle</span><span>{{ fmt(s.start) }}</span></button>
                  } @else {
                    <button type="button" (click)="flow.start.set(s.start)" class="relative py-space-sm px-space-sm rounded-lg border-[1.5px] border-[#0F9D8A] text-[#0F9D8A] bg-surface-container-lowest hover:bg-[#0F9D8A]/10 transition-colors duration-150 text-center font-label-lg font-semibold active:scale-95">{{ fmt(s.start) }}@if (best()?.slot?.start === s.start) { <span class="absolute -top-2 -right-1 bg-[#FF7A59] text-white text-[9px] font-bold px-1.5 rounded-full uppercase tracking-tight">{{ "Best" | translate }}</span> }</button>
                  }
                }
              </div>
            </div>
          }
        }

        <div class="p-space-md bg-surface-container-low rounded-xl border border-outline-variant flex flex-wrap items-center justify-around gap-space-sm text-label-md font-label-md">
          <div class="flex items-center gap-2"><span class="w-4 h-4 rounded border-[1.5px] border-[#0F9D8A] bg-surface-container-lowest"></span><span class="text-on-surface-variant font-medium">{{ 'slot.available' | translate }}</span></div>
          <div class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-[#0F9D8A] flex items-center justify-center text-white"><span class="material-symbols-outlined text-[12px]">check</span></span><span class="text-on-surface font-semibold">{{ 'slot.selected' | translate }}</span></div>
          <div class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-[#E5EBEB] border border-dashed border-[#8A9A9E]"></span><span class="text-outline font-medium">{{ 'slot.busy' | translate }}</span></div>
        </div>
      </section>
    </main>

    <aside [attr.aria-label]="'Booking Confirmation Bar' | translate" class="fixed bottom-0 left-0 w-full z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant elevation-3 py-space-sm px-space-md no-print">
      <div class="max-w-screen-md mx-auto flex items-center justify-between gap-space-md">
        <div>
          <div class="flex items-center gap-1.5 font-semibold text-label-md font-label-md" [class]="flow.start() !== null ? 'text-primary' : 'text-outline'"><span class="material-symbols-outlined text-[16px]">event_available</span><span>{{ summary() }}</span></div>
          <div class="flex items-baseline gap-1 mt-0.5"><span class="text-headline-md font-headline-md font-bold text-on-surface">{{ inr(flow.totalPrice()) }}</span><span class="text-body-sm font-body-sm text-on-surface-variant">{{ 'common.total' | translate }}</span></div>
        </div>
        <button type="button" (click)="next()" class="bg-[#FF7A59] hover:bg-[#F06543] text-white font-label-lg font-semibold py-3 px-6 rounded-xl elevation-2 flex items-center gap-2 transition-all duration-150 active:scale-95 shadow-md" [class.opacity-60]="flow.start() === null">
          <span>{{ 'slot.choose' | translate }}</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </aside>
  `,
})
export class SlotPage implements OnInit, OnDestroy {
  protected readonly flow = inject(BookingFlowStore);
  protected readonly store = inject(SalonStore);
  private readonly avail = inject(AvailabilityService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly history = inject(CustomerBookingsService);
  private poll?: ReturnType<typeof setInterval>;
  protected readonly fmt = fmt12;
  protected readonly inr = inr;
  /** Only services that still exist and are still switched on by the owner; a stale id (removed mid-session) must never block availability. */
  protected readonly serviceIds = computed(() => this.flow.services().map((s) => s.id));

  protected readonly date = computed(() => this.flow.date() ?? this.firstBookableDay());
  protected readonly names = computed(() => this.flow.services().map((s) => s.name).join(' + '));
  protected readonly monthLabel = computed(() => new Date(this.date() + 'T00:00').toLocaleDateString(LOCALE(), { month: 'long', year: 'numeric' }));
  protected readonly slots = computed(() => this.avail.slots(this.date(), { serviceIds: this.serviceIds(), includeBusy: true }));
  protected readonly noStylist = computed(() => this.store.dayTiming(this.date()).open && this.store.eligibleStaff(this.date(), this.serviceIds()).length === 0);
  /** Reactive so it follows live salon data (timings/holidays/staff) and the current service selection, not just its value when the page first mounted. */
  protected readonly days = computed(() => {
    const ids = this.serviceIds();
    return this.avail.days(14).map((d) => ({ ...d, noStaff: !d.closed && ids.length > 0 && this.store.eligibleStaff(d.key, ids).length === 0 }));
  });
  protected readonly holidayNote = computed(() => {
    const h = this.store.holidayOn(this.date());
    return h ? `The salon is closed for ${h.name}.` : 'No slots are open on this day. Please pick another date.';
  });
  protected readonly groups = computed(() => [
    { key: 'morning', icon: 'light_mode', range: '9:00 AM - 12:00 PM', slots: this.slots().filter((s) => s.period === 'morning') },
    { key: 'afternoon', icon: 'wb_sunny', range: '12:00 PM - 5:00 PM', slots: this.slots().filter((s) => s.period === 'afternoon') },
    { key: 'evening', icon: 'dark_mode', range: '5:00 PM - 9:00 PM', slots: this.slots().filter((s) => s.period === 'evening') },
  ]);
  protected readonly summary = computed(() => {
    const s = this.flow.start();
    if (s === null) return 'Pick a time slot';
    const d = new Date(this.date() + 'T00:00');
    return `${d.toLocaleDateString(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' })} @ ${fmt12(s)}`;
  });

  /** Highlights the best slot for this customer (see AvailabilityService.bestSlot). */
  protected readonly best = computed(() =>
    this.avail.bestSlot(
      this.slots(),
      this.history.bookings().filter((b) => b.status === 'completed' || b.status === 'confirmed').map((b) => b.start),
    ),
  );

  /** First day that still has at least one free slot (today may already be over). */
  private firstBookableDay() {
    const ids = this.serviceIds();
    const days = this.avail.days(14);
    return (
      days.find((d) => !d.closed && this.avail.slots(d.key, { serviceIds: ids }).length)?.key ?? days.find((d) => !d.closed)?.key ?? days[0].key
    );
  }

  ngOnInit() {
    // Slots other people book while this page is open must turn to "Booked" without a reload.
    void this.store.refreshBusy();
    this.poll = setInterval(() => void this.store.refreshBusy(), 30_000);
    void this.auth.ready.then(() => this.history.start());
    if (!this.flow.services().length) {
      this.router.navigate(['/s', this.store.profile().slug, 'services'], { replaceUrl: true });
      return;
    }
    if (!this.flow.date()) this.flow.date.set(this.date());
    // A previous slot may no longer be free (e.g. the services changed).
    const s = this.flow.start();
    if (s !== null && !this.slots().some((x) => x.start === s && x.staffIds.length)) this.flow.start.set(null);
  }

  ngOnDestroy() {
    clearInterval(this.poll);
  }

  pickDate(key: string) {
    this.flow.date.set(key);
    this.flow.start.set(null);
  }

  changeServices() {
    this.router.navigate(['/s', this.store.profile().slug, 'services']);
  }

  next() {
    if (this.flow.start() === null) return this.toast.error('Please pick a time slot.');
    this.router.navigate(['/s', this.store.profile().slug, 'stylist']);
  }
}
