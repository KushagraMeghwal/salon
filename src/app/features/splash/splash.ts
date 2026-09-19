import { TranslatePipe } from '@ngx-translate/core';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';

const MESSAGES = [
  'Connecting to salon network...',
  'Syncing stylist schedules...',
  'Securing checkout gateway...',
  'Preparing salon workspace...',
];

/** The only screen where the Chairly logo is shown. */
@Component({
  imports: [TranslatePipe],
  selector: 'app-splash',
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[#F7FAF9] text-on-surface antialiased select-none">
      <div class="relative w-full max-w-[412px] h-[100dvh] max-h-[890px] mx-auto overflow-hidden bg-[#F7FAF9] flex flex-col justify-between p-6 sm:rounded-[32px] sm:shadow-[0px_20px_48px_-8px_rgba(31,42,46,0.14)] sm:border sm:border-outline-variant/30">
        <div class="pointer-events-none absolute -top-20 -left-20 w-80 h-80 rounded-full bg-primary-fixed/25 blur-3xl opacity-70"></div>
        <div class="pointer-events-none absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-secondary-fixed/20 blur-3xl opacity-60"></div>
        <div class="pointer-events-none absolute -bottom-24 left-1/4 w-88 h-88 rounded-full bg-surface-container-highest/60 blur-3xl opacity-80"></div>

        <div></div>

        <main class="relative z-10 flex-1 flex flex-col items-center justify-center my-auto">
          <div class="relative flex items-center justify-center w-48 h-48 mb-7">
            <div class="absolute w-44 h-44 rounded-full border border-primary/25 bg-primary/5 animate-pulse-ring-1 pointer-events-none"></div>
            <div class="absolute w-40 h-40 rounded-full border border-primary/20 bg-primary/5 animate-pulse-ring-2 pointer-events-none"></div>
            <div class="relative z-10 w-28 h-28 rounded-2xl bg-surface-container-lowest flex items-center justify-center shadow-[0px_16px_32px_-8px_rgba(15,157,138,0.16),0px_4px_12px_rgba(31,42,46,0.06)] border border-outline-variant/30 animate-logo-pulse">
              <img [alt]="'Chairly' | translate" class="w-16 h-16 object-contain" src="chairly-logo.svg" />
            </div>
          </div>
          <div class="text-center px-4 max-w-xs">
            <h1 class="font-headline-lg text-3xl font-bold tracking-tight text-[#1F2A2E] mb-1.5">{{ "Chairly" | translate }}</h1>
            <p class="font-body-md text-body-md text-[#8A9A9E] tracking-tight">{{ "Smart Salon Booking & Billing" | translate }}</p>
          </div>
        </main>

        <footer class="relative z-10 w-full pb-5 pt-2 flex flex-col items-center">
          <div class="w-48 h-1.5 bg-outline-variant/25 rounded-full overflow-hidden relative mb-3">
            <div class="absolute top-0 bottom-0 left-0 w-24 bg-linear-to-r from-primary-fixed-dim via-primary to-primary-container rounded-full animate-progress-loading"></div>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
            <span class="font-body-sm text-body-sm text-[#8A9A9E] font-medium transition-opacity duration-200" [class.opacity-0]="fading()">{{ message() }}</span>
          </div>
        </footer>
      </div>
    </div>
  `,
})
export class Splash implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly store = inject(SalonStore);
  private readonly auth = inject(AuthService);
  protected readonly message = signal(MESSAGES[0]);
  protected readonly fading = signal(false);
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ticker?: ReturnType<typeof setInterval>;

  ngOnInit() {
    let i = 0;
    this.ticker = setInterval(() => {
      this.fading.set(true);
      this.timers.push(
        setTimeout(() => {
          i = (i + 1) % MESSAGES.length;
          this.message.set(MESSAGES[i]);
          this.fading.set(false);
        }, 200),
      );
    }, 900);
    void this.route();
  }

  /** Holds the brand screen for a moment, then sends each person where they belong. */
  private async route() {
    const minimum = new Promise((r) => this.timers.push(setTimeout(r, 1800)));
    await this.auth.ready;
    const role = this.auth.role();
    let target = '/';
    try {
      if (this.auth.user() && role === 'owner' && this.auth.salonId()) {
        await this.store.loadOwner(this.auth.salonId()!);
        target = this.store.onboarded() ? '/owner/dashboard' : '/owner/onboarding/salon';
      } else if (this.auth.user() && role === 'superadmin') target = '/admin';
      else if (this.auth.user() && role === 'staff') target = '/staff';
    } catch {
      target = '/';
    }
    await minimum;
    void this.router.navigateByUrl(target);
  }

  ngOnDestroy() {
    clearInterval(this.ticker);
    this.timers.forEach(clearTimeout);
  }
}
