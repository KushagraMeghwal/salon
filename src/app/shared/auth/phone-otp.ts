import { Component, OnDestroy, computed, inject, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService, authMessage } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

let seq = 0;

/** Real SMS sign-in: enter a mobile number, receive a 6-digit code, verify. Emits `verified` once signed in. */
@Component({
  selector: 'app-phone-otp',
  imports: [TranslatePipe],
  template: `
    <div class="space-y-4">
      <div>
        <label class="block text-label-md font-label-md text-on-surface font-medium mb-1.5" [for]="id + '-phone'">{{ "Mobile Number" | translate }}</label>
        <div class="flex items-center rounded-xl border bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-150 overflow-hidden shadow-sm h-12" [class]="phone().length && !phoneOk() ? 'border-error' : 'border-outline-variant'">
          <div class="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low/70 border-r border-outline-variant text-on-surface font-semibold text-body-md select-none shrink-0"><span class="font-headline-sm text-on-surface">+91</span></div>
          <input [id]="id + '-phone'" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="11" placeholder="98765 43210" class="w-full min-w-0 px-3 py-2 text-headline-sm font-headline-sm text-on-surface placeholder:text-outline border-none focus:ring-0 bg-transparent tracking-wide" [value]="phone()" [disabled]="sent()" (input)="phone.set($any($event.target).value)" (keydown.enter)="send()" />
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
        <button type="button" (click)="send()" [disabled]="busy()" class="w-full bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary py-3.5 px-5 rounded-xl font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 coral-btn-glow hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-60" [class.opacity-60]="!phoneOk()">
          @if (busy()) { <span class="w-5 h-5 rounded-full border-2 border-current/40 border-t-current animate-spin"></span> } @else { <span>{{ 'login.sendOtp' | translate }}</span><span class="material-symbols-outlined text-[20px]">sms</span> }
        </button>
      } @else {
        <div class="pt-1">
          <label class="block text-label-md font-label-md text-on-surface font-medium mb-2" [for]="id + '-0'">{{ "Verification Code" | translate }}</label>
          <div class="grid grid-cols-6 gap-2 sm:gap-2.5">
            @for (i of boxes; track i) {
              <input [id]="id + '-' + i" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" [attr.aria-label]="'Digit ' + (i + 1)" [value]="digits()[i]" (input)="onDigit(i, $event)" (keydown)="onKey(i, $event)" (paste)="onPaste($event)"
                class="w-full aspect-square min-w-0 rounded-xl bg-surface-container-lowest text-center text-headline-md font-headline-md text-on-surface font-bold shadow-sm transition-all duration-150 focus:ring-4 focus:ring-primary/20 focus:border-primary"
                [class]="error() ? 'border-2 border-error' : digits()[i] ? 'border-[1.5px] border-primary' : 'border border-outline-variant'" />
            }
          </div>
          @if (error()) { <p class="text-body-sm text-error mt-2">{{ error() | translate }}</p> }
        </div>
        <div class="flex items-center justify-between text-body-sm font-body-sm pt-1">
          <div class="flex items-center gap-1.5 text-on-surface-variant"><span class="material-symbols-outlined text-[16px] text-outline">schedule</span>@if (seconds() > 0) { <span>{{ "Resend OTP in" | translate }} <span class="font-semibold text-on-surface">0:{{ seconds() < 10 ? '0' : '' }}{{ seconds() }}s</span></span> } @else { <span>{{ "Didn't get it?" | translate }}</span> }</div>
          <button type="button" [disabled]="seconds() > 0 || busy()" (click)="resend()" class="text-label-md font-label-md font-semibold" [class]="seconds() > 0 ? 'text-outline cursor-not-allowed opacity-75' : 'text-primary hover:underline'">{{ "Resend Code" | translate }}</button>
        </div>
        <button type="button" (click)="verify()" [disabled]="busy()" class="w-full mt-2 bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary py-3.5 px-5 rounded-xl font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 coral-btn-glow hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-60" [class.opacity-60]="code().length < 6">
          @if (busy()) { <span class="w-5 h-5 rounded-full border-2 border-current/40 border-t-current animate-spin"></span> } @else { <span>{{ 'login.verify' | translate }}</span><span class="material-symbols-outlined text-[20px]">arrow_forward</span> }
        </button>
      }
      <div [id]="id + '-captcha'"></div>
    </div>
  `,
})
export class PhoneOtp implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly id = 'otp' + ++seq;
  protected readonly boxes = [0, 1, 2, 3, 4, 5];

  readonly verified = output<void>();

  protected readonly phone = signal('');
  protected readonly sent = signal(false);
  protected readonly busy = signal(false);
  protected readonly digits = signal<string[]>(['', '', '', '', '', '']);
  protected readonly error = signal('');
  protected readonly seconds = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  protected readonly phoneOk = computed(() => this.phone().replace(/\D/g, '').length === 10);
  protected readonly code = computed(() => this.digits().join(''));

  async send() {
    if (!this.phoneOk()) return this.toast.error('Enter a valid 10-digit mobile number.');
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.auth.sendPhoneCode(this.phone().replace(/\D/g, '').slice(-10), this.id + '-captcha');
      this.sent.set(true);
      this.startTimer();
      setTimeout(() => document.getElementById(this.id + '-0')?.focus(), 50);
    } catch (e) {
      this.toast.error(authMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async resend() {
    this.digits.set(['', '', '', '', '', '']);
    this.error.set('');
    await this.send();
    if (this.sent()) this.toast.info('A new code has been sent');
  }

  reset() {
    this.sent.set(false);
    this.digits.set(['', '', '', '', '', '']);
    this.error.set('');
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
    this.error.set('');
    if (v && i < 5) document.getElementById(`${this.id}-${i + 1}`)?.focus();
    if (this.code().length === 6) void this.verify();
  }

  onKey(i: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !this.digits()[i] && i > 0) document.getElementById(`${this.id}-${i - 1}`)?.focus();
    if (e.key === 'Enter') void this.verify();
  }

  onPaste(e: ClipboardEvent) {
    const text = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    this.digits.set(Array.from({ length: 6 }, (_, i) => text[i] ?? ''));
    if (text.length === 6) void this.verify();
  }

  async verify() {
    if (this.code().length < 6 || this.busy()) return;
    this.busy.set(true);
    try {
      await this.auth.confirmPhoneCode(this.code());
      this.verified.emit();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      this.error.set(code === 'auth/invalid-verification-code' ? "That code isn't right. Please try again." : authMessage(e));
      this.digits.set(['', '', '', '', '', '']);
      document.getElementById(this.id + '-0')?.focus();
    } finally {
      this.busy.set(false);
    }
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
