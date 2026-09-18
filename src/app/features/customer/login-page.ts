import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

const DEMO_OTP = '123456';

@Component({
  selector: 'app-customer-login',
  imports: [TranslatePipe],
  template: `
    <main class="w-full max-w-md mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col justify-center">
      <div class="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-[#E2ECE9] elevation-1 relative overflow-hidden">
        <div class="absolute -top-16 -right-16 w-36 h-36 bg-primary-fixed/25 rounded-full blur-2xl pointer-events-none"></div>
        <div class="absolute -bottom-16 -left-16 w-36 h-36 bg-secondary-fixed/30 rounded-full blur-2xl pointer-events-none"></div>

        <div class="mb-6 relative z-10">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-label-sm font-label-sm mb-3"><span class="material-symbols-outlined text-[14px]">verified_user</span><span>{{ "Fast & Secure Portal" | translate }}</span></div>
          <h1 class="text-headline-xl-mobile font-headline-xl-mobile text-on-surface mb-2 font-bold tracking-tight">{{ 'login.title' | translate }}</h1>
          <p class="text-body-md font-body-md text-on-surface-variant">{{ 'login.sub' | translate }}</p>
        </div>

        <div class="space-y-4 relative z-10">
          <div>
            <label class="block text-label-md font-label-md text-on-surface font-medium mb-1.5" for="login-phone">{{ "Mobile Number" | translate }}</label>
            <div class="flex items-center rounded-xl border bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-150 overflow-hidden shadow-sm h-12" [class]="phone().length && !phoneOk() ? 'border-error' : 'border-outline-variant'">
              <div class="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low/70 border-r border-outline-variant text-on-surface font-semibold text-body-md select-none shrink-0"><span class="text-base leading-none">🇮🇳</span><span class="font-headline-sm text-on-surface">+91</span></div>
              <input id="login-phone" type="tel" inputmode="numeric" maxlength="11" placeholder="98765 43210" class="w-full px-3 py-2 text-headline-sm font-headline-sm text-on-surface placeholder:text-outline border-none focus:ring-0 bg-transparent tracking-wide" [value]="phone()" [disabled]="sent()" (input)="phone.set($any($event.target).value)" (keydown.enter)="sendOtp()" />
              @if (phoneOk()) { <div class="pr-3 text-primary shrink-0 flex items-center"><span class="material-symbols-outlined text-[20px]">check_circle</span></div> }
            </div>
          </div>

          <div class="flex items-center justify-between pt-1 min-h-5">
            @if (sent()) {
              <span class="text-label-sm font-label-sm text-tertiary font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">lock</span> {{ "6-digit OTP sent via SMS" | translate }}</span>
              <button type="button" (click)="reset()" class="text-label-sm font-label-sm text-primary font-bold hover:underline">{{ "Change Number" | translate }}</button>
            } @else {
              <span class="text-label-sm font-label-sm text-outline">{{ "We'll text you a 6-digit code." | translate }}</span>
            }
          </div>

          @if (!sent()) {
            <button type="button" (click)="sendOtp()" class="w-full bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary py-3.5 px-5 rounded-xl font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 coral-btn-glow hover:shadow-lg active:scale-[0.98] transition-all duration-200" [class.opacity-60]="!phoneOk()">
              <span>{{ 'login.sendOtp' | translate }}</span><span class="material-symbols-outlined text-[20px]">sms</span>
            </button>
          } @else {
            <div class="pt-1">
              <div class="flex items-center justify-between mb-2"><label class="text-label-md font-label-md text-on-surface font-medium" for="otp-0">{{ "Verification Code" | translate }}</label><span class="text-label-sm font-label-sm text-outline">{{ "Demo code: {{p1}}" | translate: { p1: (demoOtp) } }}</span></div>
              <div class="grid grid-cols-6 gap-2 sm:gap-2.5">
                @for (i of boxes; track i) {
                  <input [id]="'otp-' + i" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" [attr.aria-label]="'Digit ' + (i + 1)" [value]="digits()[i]" (input)="onDigit(i, $event)" (keydown)="onKey(i, $event)" (paste)="onPaste($event)"
                    class="w-full aspect-square rounded-xl bg-surface-container-lowest text-center text-headline-md font-headline-md text-on-surface font-bold shadow-sm transition-all duration-150 focus:ring-4 focus:ring-primary/20 focus:border-primary"
                    [class]="error() ? 'border-2 border-error' : digits()[i] ? 'border-[1.5px] border-primary' : 'border border-outline-variant'" />
                }
              </div>
              @if (error()) { <p class="text-body-sm text-error mt-2">{{ "That code isn't right. Please try again." | translate }}</p> }
            </div>
            <div class="flex items-center justify-between text-body-sm font-body-sm pt-1">
              <div class="flex items-center gap-1.5 text-on-surface-variant"><span class="material-symbols-outlined text-[16px] text-outline">schedule</span>@if (seconds() > 0) { <span>{{ "Resend OTP in" | translate }} <span class="font-semibold text-on-surface">0:{{ seconds() < 10 ? '0' : '' }}{{ seconds() }}s</span></span> } @else { <span>{{ "Didn't get it?" | translate }}</span> }</div>
              <button type="button" [disabled]="seconds() > 0" (click)="resend()" class="text-label-md font-label-md font-semibold" [class]="seconds() > 0 ? 'text-outline cursor-not-allowed opacity-75' : 'text-primary hover:underline'">{{ "Resend Code" | translate }}</button>
            </div>
            <button type="button" (click)="verify()" class="w-full mt-2 bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary py-3.5 px-5 rounded-xl font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 coral-btn-glow hover:shadow-lg active:scale-[0.98] transition-all duration-200" [class.opacity-60]="code().length < 6">
              <span>{{ 'login.verify' | translate }}</span><span class="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          }

          <div class="relative flex py-2 items-center"><div class="grow border-t border-outline-variant/60"></div><span class="shrink mx-3 text-label-sm font-label-sm text-outline">{{ "or authenticate with" | translate }}</span><div class="grow border-t border-outline-variant/60"></div></div>
          <button type="button" (click)="google()" class="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low/50 text-on-surface text-label-md font-label-md font-semibold transition-all duration-150 active:scale-95 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
            <span>{{ 'login.google' | translate }}</span>
          </button>
        </div>

        <div class="mt-6 pt-4 border-t border-outline-variant/40 flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant relative z-10">
          <div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-tertiary">shield</span><span>{{ "256-bit encrypted" | translate }}</span></div>
        </div>
      </div>
    </main>
  `,
})
export class LoginPage implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  protected readonly demoOtp = DEMO_OTP;
  protected readonly boxes = [0, 1, 2, 3, 4, 5];

  protected readonly phone = signal('');
  protected readonly sent = signal(false);
  protected readonly digits = signal<string[]>(['', '', '', '', '', '']);
  protected readonly error = signal(false);
  protected readonly seconds = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  protected readonly phoneOk = computed(() => this.phone().replace(/\D/g, '').length === 10);
  protected readonly code = computed(() => this.digits().join(''));

  sendOtp() {
    if (!this.phoneOk()) return this.toast.error('Enter a valid 10-digit mobile number.');
    this.sent.set(true);
    this.startTimer();
    setTimeout(() => document.getElementById('otp-0')?.focus(), 50);
  }

  resend() {
    this.digits.set(['', '', '', '', '', '']);
    this.error.set(false);
    this.startTimer();
    this.toast.info('A new code has been sent');
  }

  reset() {
    this.sent.set(false);
    this.digits.set(['', '', '', '', '', '']);
    this.error.set(false);
    clearInterval(this.timer);
  }

  private startTimer() {
    clearInterval(this.timer);
    this.seconds.set(30);
    this.timer = setInterval(() => {
      this.seconds.update((s) => Math.max(0, s - 1));
      if (this.seconds() === 0) clearInterval(this.timer);
    }, 1000);
  }

  onDigit(i: number, e: Event) {
    const v = ((e.target as HTMLInputElement).value || '').replace(/\D/g, '').slice(-1);
    this.digits.update((d) => d.map((x, idx) => (idx === i ? v : x)));
    this.error.set(false);
    if (v && i < 5) document.getElementById('otp-' + (i + 1))?.focus();
    if (this.code().length === 6) this.verify();
  }

  onKey(i: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !this.digits()[i] && i > 0) document.getElementById('otp-' + (i - 1))?.focus();
    if (e.key === 'Enter') this.verify();
  }

  onPaste(e: ClipboardEvent) {
    const text = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    this.digits.set(Array.from({ length: 6 }, (_, i) => text[i] ?? ''));
    if (text.length === 6) this.verify();
  }

  verify() {
    if (this.code().length < 6) return;
    if (this.code() !== DEMO_OTP) {
      this.error.set(true);
      return;
    }
    this.finish(this.phone());
  }

  google() {
    // Real Google sign-in arrives with Firebase Auth; the demo account stands in for it.
    this.finish('9876543210');
  }

  private finish(phone: string) {
    this.auth.loginCustomer(phone);
    this.toast.success('Signed in');
    const back = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(back ?? '/my/bookings');
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
