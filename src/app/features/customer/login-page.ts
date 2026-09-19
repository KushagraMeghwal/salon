import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService, authMessage } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { GoogleButton } from '../../shared/auth/google-button';
import { PhoneOtp } from '../../shared/auth/phone-otp';

/** Customer sign-in: real Google sign-in or a real SMS code. Comes back to where the customer was (returnUrl). */
@Component({
  selector: 'app-customer-login',
  imports: [TranslatePipe, PhoneOtp, GoogleButton],
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
          <app-phone-otp (verified)="finish()" />
          <div class="relative flex py-2 items-center"><div class="grow border-t border-outline-variant/60"></div><span class="shrink mx-3 text-label-sm font-label-sm text-outline">{{ "or authenticate with" | translate }}</span><div class="grow border-t border-outline-variant/60"></div></div>
          <app-google-button [busy]="googleBusy()" (pressed)="google()" />
        </div>

        <div class="mt-6 pt-4 border-t border-outline-variant/40 flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant relative z-10">
          <div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-tertiary">shield</span><span>{{ "256-bit encrypted" | translate }}</span></div>
        </div>
      </div>
    </main>
  `,
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  protected readonly googleBusy = signal(false);

  async ngOnInit() {
    await this.auth.ready;
    // Already signed in (or just back from a redirect sign-in): carry on to where the customer was going.
    if (this.auth.user()) this.finish(false);
  }

  async google() {
    if (this.googleBusy()) return;
    this.googleBusy.set(true);
    try {
      await this.auth.signInWithGoogle();
      this.finish();
    } catch (e) {
      this.toast.error(authMessage(e));
    } finally {
      this.googleBusy.set(false);
    }
  }

  finish(announce = true) {
    if (announce) this.toast.success('Signed in');
    const back = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(back && back.startsWith('/') ? back : '/my/bookings');
  }
}
