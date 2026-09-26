import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PwaService } from '../../core/services/pwa.service';

type Audience = 'owner' | 'staff' | 'customer';

const COPY: Record<Audience, { title: string; body: string }> = {
  owner: { title: 'Install the Chairly app', body: 'Open your calendar, bills and bookings in one tap. Full screen, fast, no app store needed.' },
  staff: { title: 'Install the Chairly app', body: "See today's queue and earnings in one tap from your home screen." },
  customer: { title: 'Add this salon to your home screen', body: 'Book your next visit in one tap. Full screen, fast, no app store needed.' },
};

/**
 * Soft "install the app" nudge. Shows once the browser allows installing (or on iPhone Safari),
 * hides for a week on "Not now", and never shows inside the installed app.
 */
@Component({
  selector: 'app-install-banner',
  imports: [TranslatePipe],
  template: `
    @if (pwa.showNudge()) {
      <div
        role="dialog"
        aria-live="polite"
        [attr.aria-label]="copy().title | translate"
        class="fixed z-[45] left-3 right-3 sm:left-auto sm:right-5 sm:w-[380px] no-print animate-[install-in_.28s_ease-out]"
        [class]="lifted() ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'"
      >
        <div class="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl shadow-xl p-4 flex gap-3.5 items-start">
          <img src="icons/icon-192.png" alt="" class="w-12 h-12 rounded-xl shrink-0 shadow-sm" />
          <div class="min-w-0 flex-1">
            <p class="font-label-lg text-label-lg text-on-surface font-semibold leading-snug">{{ copy().title | translate }}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{{ copy().body | translate }}</p>
            <div class="flex items-center gap-2 mt-3">
              <button type="button" (click)="pwa.install()" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all">
                <span class="material-symbols-outlined text-[18px]">install_mobile</span>{{ 'Install' | translate }}
              </button>
              <button type="button" (click)="pwa.snooze()" class="px-3 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container font-label-md text-label-md transition-colors">{{ 'Not now' | translate }}</button>
            </div>
          </div>
          <button type="button" (click)="pwa.snooze()" class="p-1 -m-1 rounded-lg text-outline hover:text-on-surface shrink-0" [attr.aria-label]="'Close' | translate">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    @keyframes install-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  `,
})
export class InstallBanner {
  protected readonly pwa = inject(PwaService);
  readonly audience = input<Audience>('customer');
  /** Sit above a fixed bottom navigation bar. */
  readonly lifted = input(false);
  protected readonly copy = computed(() => COPY[this.audience()]);
}
