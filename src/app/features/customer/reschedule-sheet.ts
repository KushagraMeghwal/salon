import { TranslatePipe } from '@ngx-translate/core';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Booking } from '../../core/models';
import { AvailabilityService } from '../../core/services/availability.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { fmt12, inr, LOCALE } from '../../core/utils/time';

/** Bottom sheet opened from "My Bookings" to move an appointment to a free slot with the same stylist. */
@Component({
  imports: [TranslatePipe],
  selector: 'app-reschedule-sheet',
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center no-print" role="dialog" aria-modal="true" [attr.aria-label]="'Reschedule appointment' | translate">
      <div class="absolute inset-0 bg-[#1F2A2E]/55 backdrop-blur-[3px]" (click)="closed.emit()"></div>
      <div class="relative z-10 w-full max-w-md max-h-[92%] flex flex-col bg-surface-container-lowest rounded-t-3xl shadow-2xl border-t border-outline-variant/30 overflow-hidden">
        <div class="pt-3 pb-1 flex justify-center"><div class="w-12 h-1.5 rounded-full bg-outline-variant"></div></div>
        <div class="overflow-y-auto no-scrollbar px-5 pt-2 pb-6 space-y-4">
          <div class="flex items-center justify-between pb-1">
            <div><h2 class="text-headline-lg-mobile font-headline-lg-mobile text-on-surface font-bold tracking-tight">{{ "Reschedule Appointment" | translate }}</h2><p class="text-body-sm font-body-sm text-on-surface-variant mt-0.5">{{ "Select a new date & time slot for your service" | translate }}</p></div>
            <button type="button" [attr.aria-label]="'Close' | translate" (click)="closed.emit()" class="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-low hover:bg-surface-variant text-on-surface transition-colors active:scale-95"><span class="material-symbols-outlined text-xl">close</span></button>
          </div>

          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/40"><span class="material-symbols-outlined text-primary text-sm">bookmark</span><span class="text-label-sm font-label-sm text-on-surface-variant font-semibold">#{{ booking().bookingNo }} · {{ booking().serviceName }}</span></div>

          <div class="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/50">
            <div class="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant shrink-0"><span class="material-symbols-outlined text-lg">history</span></div>
            <div><p class="text-label-sm font-label-sm text-outline uppercase tracking-wider font-semibold">{{ "Current Booking" | translate }}</p><p class="text-label-md font-label-md text-on-surface font-medium">{{ label(booking().date) }}, {{ fmt(booking().start) }} <span class="text-on-surface-variant font-normal">{{ "with {{p1}}" | translate: { p1: (stylist()) } }}</span></p></div>
          </div>

          <div class="space-y-2 pt-1">
            <div class="flex items-center justify-between"><span class="text-label-md font-label-md text-on-surface font-semibold tracking-wide">{{ "Select New Date" | translate }}</span><span class="text-label-sm font-label-sm text-primary font-medium flex items-center gap-0.5"><span class="material-symbols-outlined text-xs">calendar_month</span> {{ month() }}</span></div>
            <div class="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
              @for (d of days; track d.key; let i = $index) {
                <button type="button" [disabled]="d.closed" (click)="date.set(d.key); start.set(null)" class="shrink-0 flex flex-col items-center justify-center min-w-[76px] py-2.5 px-3 rounded-xl transition-all active:scale-95 disabled:cursor-not-allowed"
                  [class]="date() === d.key ? 'bg-primary text-on-primary shadow-md shadow-primary/20 border border-primary' : d.closed ? 'border border-dashed border-outline-variant bg-surface-container text-outline opacity-70' : 'border border-outline-variant/70 bg-surface-container-lowest hover:border-primary text-on-surface'">
                  <span class="text-label-sm font-label-sm" [class]="date() === d.key ? 'text-primary-fixed font-semibold' : 'text-outline'">{{ i === 0 ? ('Today' | translate) : d.dow }}</span>
                  <span class="text-headline-sm font-headline-sm font-bold mt-0.5">{{ d.day }}</span>
                  <span class="text-label-sm font-label-sm" [class]="date() === d.key ? 'text-primary-fixed' : 'text-outline'">{{ d.closed ? ('Closed' | translate) : d.month }}</span>
                </button>
              }
            </div>
          </div>

          <div class="space-y-3.5 pt-1">
            <div class="flex items-center justify-between"><span class="text-label-md font-label-md text-on-surface font-semibold tracking-wide">{{ "Available Time Slots" | translate }}</span><span class="text-label-sm font-label-sm text-outline">{{ "IST (GMT +5:30)" | translate }}</span></div>
            @for (g of groups(); track g.key) {
              @if (g.slots.length) {
                <div class="space-y-1.5">
                  <div class="flex items-center gap-1.5 text-label-sm font-label-sm text-outline font-semibold"><span class="material-symbols-outlined text-sm" [class]="g.tone">{{ g.icon }}</span><span>{{ (g.label) | translate }}</span></div>
                  <div class="grid grid-cols-3 gap-2">
                    @for (s of g.slots; track s.start) {
                      @if (!s.staffIds.length) {
                        <button type="button" disabled class="py-2 px-2 text-center rounded-lg bg-surface-variant/40 border border-dashed border-outline/40 text-outline/70 text-label-md font-label-md cursor-not-allowed line-through">{{ fmt(s.start) }}</button>
                      } @else if (start() === s.start) {
                        <button type="button" (click)="start.set(null)" class="py-2 px-2 text-center rounded-lg bg-primary text-on-primary border border-primary font-semibold text-label-md font-label-md shadow-sm flex items-center justify-center gap-1"><span class="material-symbols-outlined text-xs">check_circle</span><span>{{ fmt(s.start) }}</span></button>
                      } @else {
                        <button type="button" (click)="start.set(s.start)" class="py-2 px-2 text-center rounded-lg border border-primary text-primary bg-surface-container-lowest hover:bg-primary/5 text-label-md font-label-md font-semibold transition-colors">{{ fmt(s.start) }}</button>
                      }
                    }
                  </div>
                </div>
              }
            } @empty {}
            @if (!slots().length) { <p class="text-body-sm text-outline text-center py-3">{{ "No slots on this day. Pick another date." | translate }}</p> }
          </div>

          <div class="p-3 rounded-xl bg-surface-container-low border border-primary/20 flex gap-2.5 items-start">
            <span class="material-symbols-outlined text-primary text-lg mt-0.5 shrink-0">info</span>
            <div class="space-y-0.5 text-left">
              <h4 class="text-label-sm font-label-sm text-on-surface font-bold tracking-tight">{{ "Cancellation & Reschedule Policy" | translate }}</h4>
              <p class="text-body-sm font-body-sm text-on-surface-variant leading-relaxed">{{ "Free rescheduling up to {{p1}} hours prior to slot. Within {{p2}} hours, a {{p3}}% salon prep fee applies" | translate: { p1: (store.settings().cancelWindowHrs), p2: (store.settings().cancelWindowHrs), p3: (store.settings().latePenaltyPct) } }}@if (fee() > 0) { <strong class="text-secondary"> {{ "— {{p1}} for this booking" | translate: { p1: (inr(fee())) } }}</strong> }.</p>
            </div>
          </div>

          <div class="space-y-2 pt-2">
            <button type="button" (click)="confirm()" [disabled]="start() === null || saving()" class="w-full h-12 bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary active:scale-[0.98] font-label-lg text-label-lg rounded-xl flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"><span class="material-symbols-outlined text-xl">check</span><span>{{ "Confirm Reschedule" | translate }}</span></button>
            <button type="button" (click)="closed.emit()" class="w-full h-10 bg-transparent hover:bg-surface-container-low text-on-surface-variant font-label-md text-label-md rounded-xl transition-colors">{{ "Keep Original Time" | translate }}</button>
          </div>
          <p class="pt-2 text-center text-label-sm font-label-sm text-on-surface-variant opacity-75">{{ "Powered by Chairly" | translate }}</p>
        </div>
      </div>
    </div>
  `,
})
export class RescheduleSheet implements OnInit {
  protected readonly store = inject(SalonStore);
  private readonly avail = inject(AvailabilityService);
  private readonly toast = inject(ToastService);
  protected readonly fmt = fmt12;
  protected readonly inr = inr;
  protected readonly days = this.avail.days(14);

  readonly booking = input.required<Booking>();
  readonly closed = output<void>();
  readonly done = output<void>();

  protected readonly date = signal<string>('');
  protected readonly start = signal<number | null>(null);

  protected readonly stylist = computed(() => this.store.staffById(this.booking().staffId)?.name ?? '');
  protected readonly fee = computed(() => this.store.cancellationFee(this.booking()));
  protected readonly month = computed(() => new Date((this.date() || this.days[0].key) + 'T00:00').toLocaleDateString(LOCALE(), { month: 'long', year: 'numeric' }));
  protected readonly slots = computed(() =>
    this.date() ? this.avail.slots(this.date(), { duration: this.booking().duration, staffId: this.booking().staffId, ignoreBookingId: this.booking().id, includeBusy: true }) : [],
  );
  protected readonly groups = computed(() => [
    { key: 'morning', label: 'Morning', icon: 'wb_sunny', tone: 'text-amber-500', slots: this.slots().filter((s) => s.period === 'morning') },
    { key: 'afternoon', label: 'Afternoon', icon: 'light_mode', tone: 'text-orange-400', slots: this.slots().filter((s) => s.period === 'afternoon') },
    { key: 'evening', label: 'Evening', icon: 'dark_mode', tone: 'text-indigo-400', slots: this.slots().filter((s) => s.period === 'evening') },
  ]);

  ngOnInit() {
    const b = this.booking();
    const free = this.days.find((d) => !d.closed && this.avail.slots(d.key, { duration: b.duration, staffId: b.staffId, ignoreBookingId: b.id }).length);
    this.date.set(free?.key ?? this.days.find((d) => !d.closed)?.key ?? this.days[0].key);
  }

  label(date: string) {
    return new Date(date + 'T00:00').toLocaleDateString(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' });
  }

  protected readonly saving = signal(false);

  async confirm() {
    const s = this.start();
    if (s === null || this.saving()) return;
    this.saving.set(true);
    const err = await this.store.rescheduleBooking(this.booking().id, this.date(), s, this.booking().salonId);
    this.saving.set(false);
    if (err) return this.toast.error(err);
    this.toast.success('Rescheduled to {{p1}}, {{p2}}', { p1: this.label(this.date()), p2: fmt12(s) });
    this.done.emit();
  }
}
