import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { toDataURL } from 'qrcode';
import { Booking } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { BookingFlowStore } from '../../core/services/booking-flow.store';
import { PaymentCheckoutService, PaymentCancelled } from '../../core/services/payment-checkout.service';
import { PaymentConnectService } from '../../core/services/payment-connect.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { fmt12, inr, LOCALE } from '../../core/utils/time';
import { StepBar } from '../../shared/customer/step-bar';

@Component({
  selector: 'app-customer-pay',
  imports: [FormsModule, StepBar, TranslatePipe],
  template: `
    <main class="w-full max-w-screen-md mx-auto px-space-md py-space-md flex-1 flex flex-col gap-space-lg">
      <app-step-bar [step]="4" />

      <section class="bg-surface-container-lowest rounded-xl p-space-lg border border-outline-variant elevation-1 flex flex-col gap-space-md">
        <div class="flex items-start justify-between border-b border-outline-variant pb-space-md gap-3">
          <div class="flex items-center gap-space-sm min-w-0">
            <div class="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined text-[28px]">storefront</span></div>
            <div class="min-w-0">
              <h1 class="font-headline-sm text-headline-sm text-on-surface font-bold truncate">{{ store.profile().name }}</h1>
              <p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 mt-0.5"><span class="material-symbols-outlined text-[14px] text-outline">location_on</span> {{ store.profile().landmark.split(',').pop()?.trim() }}, {{ store.profile().city }}</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
          <div class="flex items-center gap-space-sm bg-surface-container-low p-space-sm rounded-xl border border-outline-variant">
            <div class="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant"><span class="material-symbols-outlined text-[22px]">face</span></div>
            <div><div class="text-label-sm font-label-sm text-on-surface-variant">{{ "Stylist" | translate }}</div><div class="text-label-lg font-label-lg text-on-surface font-semibold">{{ stylistName() }}</div>@if (stylistRole()) { <div class="text-body-sm font-body-sm text-primary font-medium">{{ stylistRole() }}</div> }</div>
          </div>
          <div class="flex items-center gap-space-sm bg-surface-container-low p-space-sm rounded-xl border border-outline-variant">
            <div class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[22px]">calendar_month</span></div>
            <div><div class="text-label-sm font-label-sm text-on-surface-variant">{{ "Date & Time" | translate }}</div><div class="text-label-lg font-label-lg text-on-surface font-semibold">{{ when() }}</div><div class="text-body-sm font-body-sm text-outline flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span> {{ "{{p1}} mins duration" | translate: { p1: (flow.totalDuration()) } }}</div></div>
          </div>
        </div>

        <div class="flex flex-col gap-space-xs pt-space-xs border-t border-outline-variant">
          <span class="text-label-md font-label-md text-on-surface-variant font-semibold tracking-wide">{{ "Selected Services" | translate }}</span>
          @for (s of flow.services(); track s.id) {
            <div class="flex justify-between items-center py-1 gap-2">
              <div class="flex items-center gap-space-xs min-w-0"><span class="material-symbols-outlined text-outline text-[18px]">check_circle</span><span class="text-body-md font-body-md text-on-surface font-medium truncate">{{ s.name }}</span><span class="text-label-sm font-label-sm text-outline px-1.5 py-0.5 rounded bg-surface-container whitespace-nowrap">{{ "{{p1}} mins" | translate: { p1: (s.duration) } }}</span></div>
              <span class="text-label-lg font-label-lg text-on-surface font-semibold">{{ inr(s.price) }}</span>
            </div>
          }
        </div>

        <div class="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low border border-outline-variant mt-space-xs">
          <div><span class="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider block">{{ "Total payable" | translate }}</span>@if (store.settings().gstRegistered) { <span class="text-body-sm font-body-sm text-outline">{{ "Inclusive of GST" | translate }}</span> }</div>
          <span class="font-numeric-stat text-numeric-stat text-primary font-bold">{{ inr(flow.totalPrice()) }}</span>
        </div>
      </section>

      @if (needsName()) {
        <section class="bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant elevation-1">
          <label class="block font-label-md text-label-md text-on-surface mb-1.5" for="cust-name">{{ "Your name" | translate }}</label>
          <input id="cust-name" type="text" class="w-full h-11 px-3.5 rounded-xl border border-[#E2ECE9] bg-white text-on-surface font-body-md focus:ring-2 focus:ring-primary focus:border-primary" [placeholder]="'e.g., Ananya Roy' | translate" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        </section>
      }

      <section class="flex flex-col gap-space-md">
        <div class="flex items-center justify-between"><h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ 'pay.title' | translate }}</h2><span class="text-label-sm font-label-sm text-tertiary-container flex items-center gap-1 font-semibold"><span class="material-symbols-outlined text-[16px]">lock</span> {{ "256-bit Encrypted" | translate }}</span></div>

        <label class="relative flex flex-col p-space-md bg-surface-container-lowest rounded-xl cursor-pointer transition-all duration-150 elevation-1 hover:elevation-2" [class]="flow.payment() === 'online' ? 'border-2 border-primary' : 'border border-outline-variant hover:border-primary/50'">
          <div class="flex items-start gap-space-md">
            <input type="radio" name="payment_method" class="mt-1 h-5 w-5 text-primary border-outline focus:ring-primary" [disabled]="!rzp.onlineAvailable()" [checked]="flow.payment() === 'online'" (change)="flow.payment.set('online')" />
            <div class="flex flex-col">
              <div class="flex items-center gap-space-xs flex-wrap"><span class="text-label-lg font-label-lg text-on-surface font-bold">{{ 'pay.online' | translate }}</span><span class="px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-tertiary-container/10 text-tertiary font-semibold">{{ "Instant Confirmation" | translate }}</span></div>
              <p class="text-body-sm font-body-sm text-on-surface-variant mt-1">{{ rzp.onlineAvailable() ? ("100% cashless checkout with zero convenience fees. Supported by all major banks." | translate) : ("Online payment is not available for this salon right now." | translate) }}</p>
              <div class="flex items-center gap-2 mt-space-sm flex-wrap">
                @for (b of badges; track b.label) { <div class="px-2.5 py-1 rounded bg-surface-container border border-outline-variant text-label-sm font-label-sm font-semibold text-on-surface flex items-center gap-1"><span class="material-symbols-outlined text-[16px]" [style.color]="b.color">{{ b.icon }}</span> {{ (b.label) | translate }}</div> }
              </div>
            </div>
          </div>
        </label>

        <label class="relative flex flex-col p-space-md bg-surface-container-lowest rounded-xl transition-all duration-150 elevation-1" [class]="salonBlocked() ? 'opacity-60 cursor-not-allowed border border-outline-variant' : flow.payment() === 'salon' ? 'border-2 border-primary cursor-pointer' : 'border border-outline-variant hover:border-primary/50 cursor-pointer'">
          <div class="flex items-start gap-space-md">
            <input type="radio" name="payment_method" class="mt-1 h-5 w-5 text-primary border-outline focus:ring-primary" [disabled]="!!salonBlocked()" [checked]="flow.payment() === 'salon'" (change)="flow.payment.set('salon')" />
            <div class="flex flex-col">
              <div class="flex items-center gap-space-xs flex-wrap"><span class="text-label-lg font-label-lg text-on-surface font-semibold">{{ 'pay.salon' | translate }}</span><span class="px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-surface-variant text-on-surface-variant">{{ "Counter Settlement" | translate }}</span></div>
              <p class="text-body-sm font-body-sm text-on-surface-variant mt-1">{{ salonBlocked() || ('Pay via Cash/Card after your service at the counter. Front desk will generate your final tax receipt.' | translate) }}</p>
            </div>
          </div>
        </label>

        <div class="pt-space-xs">
          <button type="button" (click)="confirm()" [disabled]="processing()" class="w-full py-3.5 px-space-lg rounded-xl bg-[#FF7A59] hover:bg-[#F06543] active:scale-[0.98] transition-all duration-150 text-white font-label-lg text-label-lg font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-space-sm disabled:opacity-70">
            @if (processing()) { <span class="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin"></span><span>{{ (stage() === 'received' ? 'Payment received. Confirming your booking...' : 'Processing payment...') | translate }}</span> }
            @else { <span class="material-symbols-outlined text-[20px]">verified_user</span><span>{{ (flow.payment() === 'online' ? 'pay.confirm' : 'pay.confirmSalon') | translate }}{{ flow.payment() === 'online' ? ' ' + inr(flow.totalPrice()) : '' }}</span> }
          </button>
          <p class="text-center text-body-sm font-body-sm text-on-surface-variant mt-2">{{ "By continuing, you agree to {{p1}} cancellation & rescheduling policies (free until {{p2}}h before, then {{p3}}% fee)." | translate: { p1: (store.profile().name), p2: (store.settings().cancelWindowHrs), p3: (store.settings().latePenaltyPct) } }}</p>
        </div>
      </section>
    </main>

    @if (booking(); as b) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-space-md bg-inverse-surface/60 backdrop-blur-sm no-print">
        <div class="bg-surface-container-lowest w-full max-w-lg rounded-xl p-space-lg elevation-level-3 border border-outline-variant flex flex-col items-center text-center relative max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true">
          <div class="w-20 h-20 rounded-full bg-tertiary-container/20 flex items-center justify-center mb-space-sm pulse-glow"><div class="w-14 h-14 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary shadow-lg"><span class="material-symbols-outlined text-[34px] font-bold">check</span></div></div>
          <h3 class="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">{{ 'pay.confirmed' | translate }}</h3>
          <p class="font-body-md text-body-md text-on-surface-variant mt-1 max-w-sm">{{ "Your slot is locked in at {{p1}}. A confirmation SMS and WhatsApp ticket will be sent." | translate: { p1: (store.profile().name) } }}</p>
          <div class="mt-space-md mb-space-md px-4 py-1.5 rounded-full bg-surface-container-low border border-outline-variant flex items-center gap-2">
            <span class="text-label-sm font-label-sm text-on-surface-variant font-medium">{{ "Booking ID:" | translate }}</span><span class="font-label-md text-label-md text-primary font-bold tracking-wider">#{{ b.bookingNo }}</span>
            <button type="button" class="text-outline hover:text-primary transition-colors active:scale-90" [title]="'Copy ID' | translate" (click)="copyId(b)"><span class="material-symbols-outlined text-[16px]">content_copy</span></button>
          </div>
          <div class="w-full bg-surface-container-low/70 border border-outline-variant rounded-xl p-space-md text-left flex flex-col gap-2 mb-space-md">
            <div class="flex justify-between gap-3 text-body-sm"><span class="text-on-surface-variant">{{ "Service Time:" | translate }}</span><span class="text-on-surface font-semibold text-right">{{ dateLabel(b) }} • {{ fmt(b.start) }} ({{ b.duration }}m)</span></div>
            <div class="flex justify-between gap-3 text-body-sm"><span class="text-on-surface-variant">{{ "Stylist:" | translate }}</span><span class="text-on-surface font-semibold">{{ store.staffById(b.staffId)?.name }}</span></div>
            <div class="flex justify-between gap-3 text-body-sm"><span class="text-on-surface-variant">{{ "Services:" | translate }}</span><span class="text-on-surface font-semibold text-right">{{ b.serviceName }}</span></div>
            <div class="flex justify-between gap-3 text-body-sm pt-1 border-t border-outline-variant"><span class="text-on-surface-variant">{{ b.paid ? ('Amount Paid:' | translate) : ('Pay at salon:' | translate) }}</span><span class="text-primary font-bold">{{ inr(b.price) }} {{ b.paid ? '(Online Paid)' : '' }}</span></div>
          </div>
          <div class="flex flex-col items-center bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant w-full mb-space-md">
            <div class="w-36 h-36 bg-surface p-2 rounded-lg border border-outline-variant flex items-center justify-center">@if (qr()) { <img [src]="qr()" [alt]="'Check-in QR code' | translate" class="w-full h-full" /> }</div>
            <span class="text-label-sm font-label-sm text-on-surface-variant font-medium mt-2 flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">qr_code_scanner</span> {{ "Scan at salon reception desk for express check-in" | translate }}</span>
          </div>
          <a [href]="calendarUrl(b)" target="_blank" rel="noopener" class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-outline-variant hover:bg-surface-container-low text-on-surface text-label-md font-label-md font-semibold transition-colors duration-150 mb-space-md"><span class="material-symbols-outlined text-primary text-[18px]">event</span><span>{{ "Add to Google Calendar" | translate }}</span></a>
          <div class="flex flex-col gap-space-sm w-full">
            <button type="button" (click)="goBookings()" class="w-full py-3 rounded-xl bg-primary hover:bg-primary-container text-white font-label-lg text-label-lg font-bold transition-colors active:scale-95 shadow-sm">{{ 'pay.viewBookings' | translate }}</button>
            <button type="button" (click)="goHome()" class="w-full py-2.5 rounded-xl border border-outline-variant hover:bg-surface-container-low text-on-surface font-label-md text-label-md font-semibold transition-colors">{{ 'pay.home' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PayPage implements OnInit {
  protected readonly store = inject(SalonStore);
  protected readonly flow = inject(BookingFlowStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly checkout = inject(PaymentCheckoutService);
  protected readonly rzp = inject(PaymentConnectService);
  private requestId = crypto.randomUUID();
  protected readonly inr = inr;
  protected readonly fmt = fmt12;
  protected readonly badges = [
    { icon: 'account_balance_wallet', label: 'GPay', color: '#4285F4' },
    { icon: 'mobile_friendly', label: 'PhonePe', color: '#5f259f' },
    { icon: 'qr_code_2', label: 'Paytm', color: '#002e6e' },
    { icon: 'credit_card', label: 'Cards & NetBanking', color: '#6d7a76' },
  ];

  protected readonly name = signal('');
  protected readonly processing = signal(false);
  /** 'received' = Razorpay reported success in the browser; the booking is only Confirmed once the webhook lands. */
  protected readonly stage = signal<'idle' | 'received'>('idle');
  protected readonly booking = signal<Booking | null>(null);
  protected readonly qr = signal('');

  protected readonly needsName = computed(() => !this.auth.customer()?.name);
  protected readonly stylistName = computed(() => (this.flow.staffId() === 'any' ? 'Any available specialist' : this.store.staffById(this.flow.staffId())?.name ?? ''));
  protected readonly stylistRole = computed(() => (this.flow.staffId() === 'any' ? 'Assigned when you confirm' : this.store.staffById(this.flow.staffId())?.title ?? ''));
  protected readonly when = computed(() => {
    const d = this.flow.date();
    const s = this.flow.start();
    return d && s !== null ? `${new Date(d + 'T00:00').toLocaleDateString(LOCALE(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} at ${fmt12(s)}` : '';
  });
  protected readonly salonBlocked = computed(() => {
    const s = this.store.settings();
    if (!s.allowPayAtSalon) return 'This salon accepts online payment only.';
    if (s.requireOnlineAfterNoShows && this.store.noShowsOf(this.auth.customer()?.phone ?? '') >= s.noShowThreshold) return `Online payment is required after ${s.noShowThreshold} missed appointments.`;
    return '';
  });

  ngOnInit() {
    if (!this.flow.serviceIds().length || !this.flow.date() || this.flow.start() === null) {
      this.router.navigate(['/s', this.store.profile().slug, 'services'], { replaceUrl: true });
      return;
    }
    if (!this.auth.customer()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/s/${this.store.profile().slug}/pay` }, replaceUrl: true });
      return;
    }
    if (this.checkout.live) void this.rzp.load();
    if (this.salonBlocked() || !this.rzp.onlineAvailable()) this.flow.payment.set(this.rzp.onlineAvailable() ? 'online' : 'salon');
  }

  async confirm() {
    const customer = this.auth.customer();
    if (!customer || this.processing()) return;
    const nm = (customer.name || this.name()).trim();
    if (!nm) return this.toast.error('Please enter your name.');
    if (!customer.name) this.auth.setCustomerName(nm);
    if (this.flow.payment() === 'online' && !this.rzp.onlineAvailable()) return this.toast.error('Online payment is not available for this salon right now.');
    if (this.flow.payment() === 'online' && this.checkout.live) return this.confirmLive(nm, customer.phone);
    this.processing.set(true);
    // Mock mode: stand-in for the Razorpay order + webhook round trip.
    if (this.flow.payment() === 'online') await new Promise((r) => setTimeout(r, 900));
    const res = this.store.createOnlineBooking({
      date: this.flow.date()!, staffId: this.flow.staffId(), serviceIds: this.flow.serviceIds(), start: this.flow.start()!,
      client: nm, phone: customer.phone, payment: this.flow.payment(),
    });
    this.processing.set(false);
    if (!res.ok) {
      this.toast.error(res.error);
      this.router.navigate(['/s', this.store.profile().slug, 'slot']);
      return;
    }
    this.booking.set(res.booking);
    this.qr.set(await toDataURL(res.booking.bookingNo ?? res.booking.id, { margin: 1, width: 240, color: { dark: '#121d21', light: '#ffffff' } }));
    this.flow.reset();
  }

  /** Live online payment: hold + server-priced order + Checkout, then wait for the webhook-driven confirmation. */
  private async confirmLive(name: string, phone: string) {
    const salonId = this.store.profile().slug; // TODO(Phase 4b): the real Firestore salon id
    this.processing.set(true);
    this.stage.set('idle');
    try {
      const bookingId = await this.checkout.payOnline({
        salonId, salonName: this.store.profile().name, requestId: this.requestId, serviceIds: this.flow.serviceIds(),
        staffId: this.flow.staffId(), date: this.flow.date()!, start: this.flow.start()!, customerName: name, customerPhone: phone,
      });
      this.stage.set('received'); // "Payment received. Confirming your booking..." (NOT "Confirmed")
      const confirmed = await this.checkout.waitForConfirmed(salonId, bookingId);
      if (!confirmed) {
        this.toast.info('Payment received. Your booking will be confirmed shortly. Check My Bookings.');
        this.router.navigate(['/my/bookings']);
        return;
      }
      const b = this.checkout.toBooking(confirmed);
      this.booking.set(b);
      this.qr.set(await toDataURL(b.bookingNo ?? b.id, { margin: 1, width: 240, color: { dark: '#121d21', light: '#ffffff' } }));
      this.flow.reset();
      this.requestId = crypto.randomUUID();
    } catch (e) {
      if (e instanceof PaymentCancelled) this.toast.info('Payment cancelled. Your slot is held for a few minutes.');
      else this.toast.error(this.safeMessage(e));
    } finally {
      this.processing.set(false);
      this.stage.set('idle');
    }
  }

  /** Server messages are already user-safe; anything else becomes a generic line. */
  private safeMessage(e: unknown) {
    const code = (e as { code?: string })?.code ?? '';
    const msg = (e as { message?: string })?.message ?? '';
    return code.startsWith('functions/') && msg && !/internal/i.test(msg) ? msg : 'Something went wrong. Please try again.';
  }

  dateLabel(b: Booking) {
    return new Date(b.date + 'T00:00').toLocaleDateString(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' });
  }

  calendarUrl(b: Booking) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = b.date.replace(/-/g, '');
    const stamp = (m: number) => `${day}T${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
    const p = new URLSearchParams({
      action: 'TEMPLATE', text: `${b.serviceName} at ${this.store.profile().name}`, dates: `${stamp(b.start)}/${stamp(b.start + b.duration)}`,
      details: `Booking ${b.bookingNo}`, location: `${this.store.profile().street}, ${this.store.profile().city}`,
    });
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  }

  async copyId(b: Booking) {
    try {
      await navigator.clipboard.writeText(b.bookingNo ?? '');
      this.toast.success('Booking ID copied');
    } catch {
      this.toast.error('Could not copy');
    }
  }

  goBookings() {
    this.router.navigateByUrl('/my/bookings');
  }
  goHome() {
    this.router.navigate(['/s', this.store.profile().slug]);
  }
}
