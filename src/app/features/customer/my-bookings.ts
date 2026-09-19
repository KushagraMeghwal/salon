import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { toDataURL } from 'qrcode';
import { Booking } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { BookingFlowStore } from '../../core/services/booking-flow.store';
import { CustomerBookingsService } from '../../core/services/customer-bookings.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { dateKey, fmt12, initials, inr, LOCALE } from '../../core/utils/time';
import { tr } from '../../core/utils/i18n';
import { Modal } from '../../shared/ui/modal';
import { RescheduleSheet } from './reschedule-sheet';

@Component({
  selector: 'app-my-bookings',
  imports: [TranslatePipe, Modal, RescheduleSheet],
  template: `
    <div class="px-space-md pt-space-md pb-space-xs w-full max-w-screen-md mx-auto">
      <div class="flex items-center justify-between mb-space-sm gap-3">
        <div><h1 class="text-headline-lg-mobile font-headline-lg-mobile text-on-surface font-bold">{{ 'bookings.title' | translate }}</h1><p class="text-body-sm font-body-sm text-on-surface-variant mt-0.5">{{ "Manage your upcoming and completed salon sessions" | translate }}</p></div>
        <div class="flex items-center gap-1.5 bg-surface-container-low px-space-sm py-1 rounded-full border border-outline-variant/30 whitespace-nowrap"><span class="w-2 h-2 rounded-full bg-[#22A06B] animate-pulse"></span><span class="text-label-sm font-label-sm text-primary font-semibold">{{ "Live status" | translate }}</span></div>
      </div>
      <div class="bg-surface-container p-1 rounded-xl flex items-center gap-1 border border-outline-variant/40 mt-space-xs" role="tablist">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'upcoming'" (click)="tab.set('upcoming')" class="flex-1 py-2 px-space-sm rounded-lg text-label-md font-label-md text-center flex items-center justify-center gap-1.5 transition-all" [class]="tab() === 'upcoming' ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface font-medium'"><span>{{ 'bookings.upcoming' | translate }}</span><span class="text-label-sm font-label-sm px-1.5 py-0.5 rounded-full" [class]="tab() === 'upcoming' ? 'bg-white/20 text-white' : 'bg-surface-dim/60 text-on-surface-variant'">{{ upcoming().length }}</span></button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'past'" (click)="tab.set('past')" class="flex-1 py-2 px-space-sm rounded-lg text-label-md font-label-md text-center flex items-center justify-center gap-1.5 transition-all" [class]="tab() === 'past' ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface font-medium'"><span>{{ 'bookings.past' | translate }}</span><span class="text-label-sm font-label-sm px-1.5 py-0.5 rounded-full" [class]="tab() === 'past' ? 'bg-white/20 text-white' : 'bg-surface-dim/60 text-on-surface-variant'">{{ past().length }}</span></button>
      </div>
    </div>

    <main class="px-space-md py-space-sm flex flex-col gap-space-md flex-1 w-full max-w-screen-md mx-auto">
      @if (loading()) {
        <div class="flex flex-col gap-space-md" aria-busy="true">@for (i of [1, 2]; track i) { <div class="h-56 rounded-2xl bg-surface-container animate-pulse"></div> }</div>
      } @else if (failed()) {
        <div class="text-center py-space-xl text-on-surface-variant flex flex-col items-center gap-2"><span class="material-symbols-outlined text-5xl text-error/50">cloud_off</span><p class="text-body-md">{{ "We could not load your bookings. Check your connection and refresh." | translate }}</p></div>
      }
      @for (b of shown(); track b.id) {
        <section class="bg-surface-container-lowest rounded-2xl border border-[#E2ECE9] p-space-md elevation-level-1 hover:elevation-level-2 transition-all duration-200" [class.opacity-80]="b.status === 'cancelled'">
          <div class="flex items-start justify-between pb-space-sm border-b border-surface-container gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm font-semibold" [class]="statusClass(b)"><span class="w-1.5 h-1.5 rounded-full bg-current"></span>{{ statusLabel(b) }}</span>
                <span class="text-body-sm text-outline">•</span><span class="text-label-sm font-label-sm text-on-surface-variant font-medium">{{ whenLabel(b) }}</span>
              </div>
              <h2 class="text-headline-sm font-headline-sm text-on-surface font-semibold">{{ b.salonName }}</h2>
              <p class="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1 mt-0.5"><span class="material-symbols-outlined text-sm text-outline">location_on</span> {{ b.salonAddress }}</p>
            </div>
            <span class="text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap" [class]="b.paid ? 'bg-[#22A06B]/10 text-[#22A06B]' : 'bg-surface-container-high text-on-surface-variant'">{{ b.paid ? ('Paid' | translate) : ('Pay at Salon' | translate) }}</span>
          </div>

          <div class="mt-space-sm bg-surface-container-low/70 rounded-xl p-space-sm flex items-center gap-space-sm border border-outline-variant/30">
            <div class="w-10 h-10 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center border border-outline-variant/40 shadow-xs"><span class="material-symbols-outlined">calendar_month</span></div>
            <div><div class="text-label-md font-label-md text-on-surface font-semibold">{{ "{{p1}} at {{p2}}" | translate: { p1: (dateLabel(b)), p2: (fmt(b.start)) } }}</div><div class="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-xs">schedule</span><span>{{ ((b.services?.length ?? 0) > 1 ? "{{p1}} mins combined service" : "{{p1}} mins") | translate: { p1: b.duration } }}</span></div></div>
          </div>

          <div class="mt-space-sm flex items-center justify-between py-space-xs gap-3">
            <div class="flex items-center gap-space-sm min-w-0">
              <div class="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-sm border-2 border-surface-container-lowest shadow-sm shrink-0">{{ initials(stylistName(b)) }}</div>
              <div class="min-w-0"><div class="text-headline-sm font-headline-sm text-on-surface leading-tight truncate">{{ stylistName(b) }}</div></div>
            </div>
          </div>

          <div class="mt-space-sm pt-space-xs border-t border-surface-container space-y-1.5">
            @for (s of lines(b); track s.name) {
              <div class="flex items-center justify-between text-body-md font-body-md text-on-surface gap-2"><div class="flex items-center gap-2 min-w-0"><span class="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span><span class="truncate">{{ s.name }}</span><span class="text-label-sm font-label-sm text-on-surface-variant bg-surface-container px-1.5 rounded whitespace-nowrap">{{ "{{p1}} mins" | translate: { p1: (s.duration) } }}</span></div><span class="font-medium">{{ inr(s.price) }}</span></div>
            }
          </div>

          <div class="mt-space-sm pt-space-sm border-t border-surface-container flex items-center justify-between">
            <div><span class="text-body-sm font-body-sm text-on-surface-variant block">{{ "Total Amount" | translate }}</span><span class="text-headline-sm font-headline-sm text-on-surface font-bold text-lg">{{ inr(b.price) }}</span></div>
            @if (b.paid) { <span class="inline-flex items-center gap-1 text-label-sm font-label-sm text-[#22A06B] bg-[#22A06B]/10 px-2 py-0.5 rounded-full font-semibold"><span class="material-symbols-outlined text-sm">check_circle</span> {{ (b.payment === 'online' ? "Paid Online" : "Paid at Salon") | translate }}</span> }
          </div>

          @if (isUpcoming(b)) {
            <div class="mt-space-md pt-space-xs flex flex-col gap-2">
              <button type="button" (click)="showPass(b)" class="w-full py-2.5 px-space-md rounded-xl bg-primary text-on-primary text-label-lg font-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors active:scale-[0.99]"><span class="material-symbols-outlined text-lg">qr_code_2</span><span>{{ 'bookings.viewPass' | translate }}</span></button>
              <div class="grid grid-cols-2 gap-2 mt-0.5">
                <button type="button" (click)="openReschedule(b)" class="w-full py-2 px-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-label-md font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-low hover:border-primary transition-all active:scale-[0.98]"><span class="material-symbols-outlined text-base text-primary">calendar_month</span><span>{{ 'bookings.reschedule' | translate }}</span></button>
                <button type="button" (click)="openCancel(b)" class="w-full py-2 px-space-sm rounded-xl border border-outline-variant/60 bg-transparent text-secondary hover:bg-secondary-fixed/30 hover:border-secondary transition-all text-label-md font-label-md font-semibold flex items-center justify-center gap-1 active:scale-[0.98]"><span class="material-symbols-outlined text-base">close</span><span>{{ 'bookings.cancel' | translate }}</span></button>
              </div>
            </div>
          } @else if (b.status === 'completed') {
            <div class="mt-space-md pt-space-xs"><button type="button" (click)="rebook(b)" class="w-full py-2.5 rounded-xl border border-primary text-primary text-label-md font-label-md font-semibold hover:bg-primary/5 flex items-center justify-center gap-1.5 active:scale-[0.99]"><span class="material-symbols-outlined text-base">replay</span> {{ "Book again" | translate }}</button></div>
          }
        </section>
      } @empty {
        @if (!loading() && !failed()) {
        <div class="text-center py-space-2xl text-on-surface-variant flex flex-col items-center gap-2"><span class="material-symbols-outlined text-5xl text-primary/30">event_busy</span><p class="text-body-md">{{ 'bookings.empty' | translate }}</p><button type="button" (click)="bookNew()" class="mt-2 px-5 py-2.5 rounded-xl bg-secondary-container text-on-secondary-container font-label-lg font-bold">{{ 'common.bookNow' | translate }}</button></div>
        }
      }

      <div class="bg-surface-container-low rounded-xl p-space-md border border-outline-variant/30 flex items-start gap-space-sm">
        <span class="material-symbols-outlined text-primary text-xl mt-0.5">info</span>
        <div><h3 class="text-label-md font-label-md text-on-surface font-semibold">{{ "Need to reschedule?" | translate }}</h3><p class="text-body-sm font-body-sm text-on-surface-variant mt-0.5">{{ "Each salon sets its own cancellation and rescheduling policy. Any fee is shown before you confirm." | translate }}</p></div>
      </div>
    </main>

    <app-modal [open]="passFor() !== null" [title]="'Check-in pass' | translate" (closed)="passFor.set(null)">
      @if (passFor(); as b) {
        <div class="flex flex-col items-center text-center gap-3">
          <div class="w-48 h-48 bg-surface p-2 rounded-lg border border-outline-variant flex items-center justify-center">@if (qr()) { <img [src]="qr()" [alt]="'Check-in QR code' | translate" class="w-full h-full" /> }</div>
          <p class="text-label-lg font-label-lg text-primary font-bold tracking-wider">#{{ b.bookingNo }}</p>
          <p class="text-body-sm text-on-surface-variant">{{ dateLabel(b) }} · {{ fmt(b.start) }} · {{ stylistName(b) }}<br />{{ "Show this at the reception desk for express check-in." | translate }}</p>
        </div>
      }
    </app-modal>

    <app-modal [open]="cancelTarget() !== null" [title]="'Cancel booking?' | translate" (closed)="cancelTarget.set(null)">
      @if (cancelTarget(); as b) {
        <div class="space-y-4">
          <p class="text-body-md text-on-surface-variant">{{ "{{p1}} on" | translate: { p1: (b.serviceName) } }} <strong class="text-on-surface">{{ "{{p1}} at {{p2}}" | translate: { p1: (dateLabel(b)), p2: (fmt(b.start)) } }}</strong>.</p>
          @if (store.cancellationFee(b) > 0) {
            <div class="p-3 rounded-xl bg-secondary-fixed/50 border border-secondary-container/30 text-body-sm text-on-secondary-fixed-variant flex gap-2"><span class="material-symbols-outlined text-secondary text-[20px]">warning</span><span>{{ "This is within {{p1}} hours of your slot, so a {{p2}}% prep fee of" | translate: { p1: (store.settings().cancelWindowHrs), p2: (store.settings().latePenaltyPct) } }} <strong>{{ inr(store.cancellationFee(b)) }}</strong> {{ "applies." | translate }}</span></div>
          } @else {
            <div class="p-3 rounded-xl bg-tertiary-fixed/30 border border-tertiary/20 text-body-sm text-tertiary flex gap-2"><span class="material-symbols-outlined text-[20px]">check_circle</span><span>{{ "Free cancellation — no fee applies." | translate }}</span></div>
          }
          <div class="flex justify-end gap-3 pt-3 border-t border-outline-variant/20"><button type="button" class="px-4 py-2 rounded-lg text-label-md font-label-md text-on-surface-variant hover:text-on-surface" (click)="cancelTarget.set(null)">{{ "Keep booking" | translate }}</button><button type="button" class="px-5 py-2 rounded-lg text-label-md font-label-md bg-error text-on-error font-semibold hover:opacity-90" (click)="doCancel(b)">{{ "Cancel booking" | translate }}</button></div>
        </div>
      }
    </app-modal>

    @if (reschedule(); as b) {
      <app-reschedule-sheet [booking]="b" (closed)="reschedule.set(null)" (done)="reschedule.set(null)" />
    }
  `,
})
export class MyBookings implements OnInit {
  protected readonly store = inject(SalonStore);
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CustomerBookingsService);
  private readonly flow = inject(BookingFlowStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly inr = inr;
  protected readonly fmt = fmt12;
  protected readonly initials = initials;

  protected readonly tab = signal<'upcoming' | 'past'>('upcoming');
  protected readonly reschedule = signal<Booking | null>(null);
  protected readonly cancelTarget = signal<Booking | null>(null);
  protected readonly passFor = signal<Booking | null>(null);
  protected readonly qr = signal('');

  protected readonly loading = this.svc.loading;
  protected readonly failed = this.svc.failed;
  private readonly mine = this.svc.bookings;
  protected readonly upcoming = computed(() => this.mine().filter((b) => this.isUpcoming(b)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start));
  protected readonly past = computed(() => this.mine().filter((b) => !this.isUpcoming(b)).sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start));
  protected readonly shown = computed(() => (this.tab() === 'upcoming' ? this.upcoming() : this.past()));

  async ngOnInit() {
    await this.auth.ready;
    if (!this.auth.customer()) return void this.router.navigate(['/login'], { queryParams: { returnUrl: '/my/bookings' }, replaceUrl: true });
    this.svc.start();
  }

  /** The cancellation fee and the reschedule slots depend on that salon's own settings, so load it first. */
  private async withSalon(b: Booking): Promise<boolean> {
    try {
      if (b.salonSlug && (await this.store.loadPublic(b.salonSlug))) return true;
    } catch {
      /* falls through */
    }
    this.toast.error('Could not load this salon. Please try again.');
    return false;
  }

  async openCancel(b: Booking) {
    if (await this.withSalon(b)) this.cancelTarget.set(b);
  }

  async openReschedule(b: Booking) {
    if (await this.withSalon(b)) this.reschedule.set(b);
  }

  isUpcoming(b: Booking) {
    return b.status !== 'cancelled' && b.status !== 'completed' && this.store.hoursUntil(b) > -b.duration / 60;
  }

  statusLabel(b: Booking) {
    return tr(b.status === 'cancelled' ? 'Cancelled' : b.status === 'completed' ? 'Completed' : b.status === 'in-progress' ? 'In progress' : 'Confirmed');
  }
  statusClass(b: Booking) {
    return b.status === 'cancelled' ? 'bg-error/10 text-error' : b.status === 'completed' ? 'bg-surface-container text-on-surface-variant' : 'bg-[#22A06B]/10 text-[#22A06B]';
  }
  whenLabel(b: Booking) {
    const days = Math.round((new Date(b.date + 'T00:00').getTime() - new Date(dateKey(new Date()) + 'T00:00').getTime()) / 86400000);
    return days === 0 ? tr('Today') : days === 1 ? tr('Tomorrow') : days > 1 ? tr('In {{p1}} days', { p1: days }) : tr('{{p1}} days ago', { p1: -days });
  }
  dateLabel(b: Booking) {
    return new Date(b.date + 'T00:00').toLocaleDateString(LOCALE(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
  stylistName(b: Booking) {
    return b.staffName || 'Stylist';
  }
  lines(b: Booking) {
    return b.services?.length ? b.services : [{ name: b.serviceName, price: b.price, duration: b.duration }];
  }

  async showPass(b: Booking) {
    this.passFor.set(b);
    this.qr.set(await toDataURL(b.bookingNo ?? b.id, { margin: 1, width: 300, color: { dark: '#121d21', light: '#ffffff' } }));
  }

  async doCancel(b: Booking) {
    const fee = this.store.cancellationFee(b);
    const err = await this.store.cancelBooking(b.id, b.salonId);
    this.cancelTarget.set(null);
    if (err) return this.toast.error(err);
    if (fee) this.toast.info('Booking cancelled. A {{p1}} fee applies.', { p1: this.inr(fee) });
    else this.toast.info('Booking cancelled');
  }

  rebook(b: Booking) {
    const ids = this.lines(b).map((l) => l.serviceId).filter((x): x is string => !!x);
    this.flow.reset();
    ids.forEach((id) => this.flow.toggle(id));
    this.router.navigate(['/s', b.salonSlug, ids.length ? 'slot' : 'services']);
  }

  bookNew() {
    const slug = this.store.lastSlug();
    if (slug) this.router.navigate(['/s', slug]);
  }
}
