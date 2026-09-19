import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService, authMessage } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { GoogleButton } from '../../shared/auth/google-button';
import { PhoneOtp } from '../../shared/auth/phone-otp';

type Method = 'phone' | 'email';

/**
 * The first screen of the app (route "/"): salon owner and platform admin sign-in / sign-up.
 * First sign-in creates the owner's salon; later sign-ins go straight to the dashboard.
 */
@Component({
  selector: 'app-owner-login',
  imports: [FormsModule, TranslatePipe, PhoneOtp, GoogleButton],
  template: `
    <div class="min-h-dvh flex flex-col bg-[#F7FAF9] text-on-surface antialiased">
      <div class="pointer-events-none fixed -top-24 -left-24 w-80 h-80 rounded-full bg-primary-fixed/25 blur-3xl"></div>
      <div class="pointer-events-none fixed bottom-0 -right-24 w-72 h-72 rounded-full bg-secondary-fixed/25 blur-3xl"></div>

      <main class="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div class="w-full max-w-md">
          <div class="text-center mb-6">
            <h1 class="text-3xl font-bold tracking-tight text-primary">{{ "Chairly" | translate }}</h1>
            <p class="text-body-md text-on-surface-variant mt-1">{{ "Smart Salon Booking & Billing" | translate }}</p>
          </div>

          <div class="bg-surface-container-lowest rounded-2xl p-5 sm:p-8 border border-[#E2ECE9] elevation-1">
            <h2 class="text-headline-md font-headline-md font-bold text-on-surface">{{ (mode() === 'signup' ? 'Create your salon account' : 'Welcome back') | translate }}</h2>
            <p class="text-body-md text-on-surface-variant mt-1 mb-5">{{ (mode() === 'signup' ? 'Start your 14-day free trial. No card needed.' : 'Sign in to manage your salon.') | translate }}</p>

            <div class="space-y-4">
              <app-google-button [busy]="busy() === 'google'" (pressed)="google()" />
              <div class="relative flex items-center"><div class="grow border-t border-outline-variant/60"></div><span class="shrink mx-3 text-label-sm text-outline">{{ "or" | translate }}</span><div class="grow border-t border-outline-variant/60"></div></div>

              <div class="flex bg-surface-container p-1 rounded-xl border border-outline-variant/40" role="tablist">
                <button type="button" role="tab" [attr.aria-selected]="method() === 'phone'" (click)="method.set('phone')" class="flex-1 py-2 rounded-lg text-label-md font-label-md flex items-center justify-center gap-1.5 transition-all" [class]="method() === 'phone' ? 'bg-surface-container-lowest text-primary font-semibold shadow-sm' : 'text-on-surface-variant'"><span class="material-symbols-outlined text-[18px]">smartphone</span>{{ "Mobile" | translate }}</button>
                <button type="button" role="tab" [attr.aria-selected]="method() === 'email'" (click)="method.set('email')" class="flex-1 py-2 rounded-lg text-label-md font-label-md flex items-center justify-center gap-1.5 transition-all" [class]="method() === 'email' ? 'bg-surface-container-lowest text-primary font-semibold shadow-sm' : 'text-on-surface-variant'"><span class="material-symbols-outlined text-[18px]">mail</span>{{ "Email" | translate }}</button>
              </div>

              @if (method() === 'phone') {
                <app-phone-otp (verified)="continue()" />
              } @else {
                <form class="space-y-3" (ngSubmit)="submitEmail()" #f="ngForm">
                  @if (mode() === 'signup') {
                    <div>
                      <label class="block text-label-md font-label-md font-medium mb-1.5" for="ow-name">{{ "Your name" | translate }}</label>
                      <input id="ow-name" name="name" type="text" autocomplete="name" class="w-full h-12 px-3.5 rounded-xl border border-outline-variant bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary" [(ngModel)]="name" />
                    </div>
                  }
                  <div>
                    <label class="block text-label-md font-label-md font-medium mb-1.5" for="ow-email">{{ "Email" | translate }}</label>
                    <input id="ow-email" name="email" type="email" inputmode="email" autocomplete="email" required class="w-full h-12 px-3.5 rounded-xl border border-outline-variant bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary" [(ngModel)]="email" />
                  </div>
                  <div>
                    <label class="block text-label-md font-label-md font-medium mb-1.5" for="ow-pass">{{ "Password" | translate }}</label>
                    <input id="ow-pass" name="password" type="password" [autocomplete]="mode() === 'signup' ? 'new-password' : 'current-password'" required minlength="6" class="w-full h-12 px-3.5 rounded-xl border border-outline-variant bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary" [(ngModel)]="password" />
                  </div>
                  <button type="submit" [disabled]="busy() === 'email'" class="w-full bg-primary hover:bg-primary-container text-on-primary py-3.5 rounded-xl font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60">
                    @if (busy() === 'email') { <span class="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin"></span> } @else { {{ (mode() === 'signup' ? 'Create account' : 'Sign in') | translate }} }
                  </button>
                  @if (mode() === 'login') { <button type="button" (click)="forgot()" class="text-label-md font-label-md text-primary font-semibold hover:underline">{{ "Forgot password?" | translate }}</button> }
                </form>
              }
            </div>

            <p class="text-body-md text-on-surface-variant text-center mt-6">
              @if (mode() === 'login') { {{ "New to Chairly?" | translate }} <button type="button" class="text-primary font-semibold hover:underline" (click)="mode.set('signup')">{{ "Create an account" | translate }}</button> }
              @else { {{ "Already have an account?" | translate }} <button type="button" class="text-primary font-semibold hover:underline" (click)="mode.set('login')">{{ "Sign in" | translate }}</button> }
            </p>
          </div>

          <p class="text-center text-label-sm text-outline mt-5">{{ "Customers: open your salon's booking link or QR code to book." | translate }}</p>
        </div>
      </main>
    </div>
  `,
})
export class OwnerLogin implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly mode = signal<'login' | 'signup'>('login');
  protected readonly method = signal<Method>('phone');
  protected readonly busy = signal<'' | 'google' | 'email'>('');
  protected name = '';
  protected email = '';
  protected password = '';

  async ngOnInit() {
    await this.auth.ready;
    const role = this.auth.role();
    // A saved owner / admin / stylist session skips the form.
    if (this.auth.user() && role !== 'customer') void this.go(role);
  }

  async google() {
    if (this.busy()) return;
    this.busy.set('google');
    try {
      await this.auth.signInWithGoogle();
      await this.continue();
    } catch (e) {
      this.toast.error(authMessage(e));
    } finally {
      this.busy.set('');
    }
  }

  async submitEmail() {
    if (this.busy()) return;
    if (!this.email.trim() || this.password.length < 6) return this.toast.error('Enter your email and a password of at least 6 characters.');
    this.busy.set('email');
    try {
      if (this.mode() === 'signup') await this.auth.signUpWithEmail(this.name, this.email, this.password);
      else await this.auth.signInWithEmail(this.email, this.password);
      await this.continue();
    } catch (e) {
      this.toast.error(authMessage(e));
    } finally {
      this.busy.set('');
    }
  }

  async forgot() {
    if (!this.email.trim()) return this.toast.error('Enter your email first.');
    try {
      await this.auth.resetPassword(this.email);
      this.toast.success('Password reset link sent. Check your email.');
    } catch (e) {
      this.toast.error(authMessage(e));
    }
  }

  /** After any sign-in: make sure this account is an owner (creating the salon the first time), then go in. */
  async continue() {
    try {
      const res = await this.auth.registerOwner();
      await this.go(res.role);
    } catch (e) {
      this.toast.error(authMessage(e));
      await this.auth.signOut();
    }
  }

  private async go(role: string) {
    const back = this.route.snapshot.queryParamMap.get('returnUrl');
    if (role === 'superadmin') return this.router.navigateByUrl(back?.startsWith('/admin') ? back : '/admin');
    if (role === 'staff') return this.router.navigateByUrl('/staff');
    return this.router.navigateByUrl(back?.startsWith('/owner') ? back : '/splash');
  }
}
