import { TranslatePipe } from '@ngx-translate/core';
import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { initials } from '../../core/utils/time';
import { LangToggle } from '../customer/lang-toggle';
import { SalonMark } from './salon-mark';

export const WIZARD_STEPS = [
  { n: 1, label: 'Salon Details', path: 'salon' },
  { n: 2, label: 'Services & Pricing', path: 'services' },
  { n: 3, label: 'Timings & Slots', path: 'timings' },
  { n: 4, label: 'Staff & Team', path: 'staff' },
];

@Component({
  selector: 'app-wizard-header',
  imports: [RouterLink, SalonMark, TranslatePipe, LangToggle],
  template: `
    <header class="sticky top-0 z-50 flex items-center justify-between w-full h-16 px-4 md:px-8 max-w-full bg-surface-container-lowest border-b border-outline-variant/20 shadow-sm no-print">
      <div class="flex items-center gap-3 min-w-0">
        <app-salon-mark size="sm" />
        <span class="text-headline-md font-headline-md font-bold text-primary tracking-tight truncate max-w-40 md:max-w-56">{{ store.profile().name || ('Your Salon' | translate) }}</span>
        <span class="hidden lg:inline-flex ml-2 px-2 py-0.5 rounded-full bg-surface-container text-muted text-label-sm font-label-sm border border-outline-variant/30">{{ "Partner Setup" | translate }}</span>
      </div>

      <nav class="hidden md:flex items-center gap-6 lg:gap-8">
        @for (s of steps; track s.n) {
          @if (s.n === active() && !complete()) {
            <span class="text-primary border-b-2 border-primary font-semibold pb-1 flex items-center gap-2 text-label-lg font-label-lg">
              <span class="w-5 h-5 rounded-full bg-primary text-on-primary text-label-sm font-label-sm flex items-center justify-center">{{ s.n }}</span>
              <span>{{ s.n }}. {{ (s.label) | translate }}</span>
            </span>
          } @else if (s.n < active() || complete()) {
            <a [routerLink]="['/owner/onboarding', s.path]" class="text-primary flex items-center gap-2 transition-colors text-label-md font-label-md hover:text-primary-container">
              <span class="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">check</span>
              </span>
              <span>{{ s.n }}. {{ (s.label) | translate }}</span>
            </a>
          } @else {
            <span class="text-muted flex items-center gap-2 text-label-md font-label-md">
              <span class="w-5 h-5 rounded-full bg-surface-container-high text-muted text-label-sm font-label-sm flex items-center justify-center">{{ s.n }}</span>
              <span>{{ s.n }}. {{ (s.label) | translate }}</span>
            </span>
          }
        }
      </nav>

      <div class="flex items-center gap-2 md:gap-3">
        <button type="button" class="hidden sm:block p-2 text-muted hover:text-on-surface rounded-lg hover:bg-surface-container-low transition-colors duration-150" [title]="'Help & Guides' | translate" (click)="toast.info('Partner support: support@chairly.app')">
          <span class="material-symbols-outlined text-xl">help_outline</span>
        </button>
        @if (!complete()) {
          <app-lang-toggle [always]="true" />
          <button type="button" (click)="saveDraft()" class="hidden sm:block text-body-sm font-label-lg px-3.5 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface hover:bg-surface-container-low active:scale-[0.99] transition-all">{{ "Save Draft" | translate }}</button>
        }
        <button type="button" (click)="exit()" class="text-body-sm font-label-lg px-3.5 py-1.5 rounded-lg text-secondary hover:bg-error-container/20 active:scale-[0.99] transition-all">{{ "Exit Setup" | translate }}</button>
        <div class="hidden sm:block h-6 w-px bg-outline-variant/30 mx-1"></div>
        <div class="hidden sm:flex w-8 h-8 rounded-full bg-primary-container text-on-primary-container items-center justify-center text-label-md font-label-md ring-2 ring-surface-variant">{{ initials(auth.user().name) }}</div>
      </div>
    </header>
    <div class="md:hidden bg-surface-container-lowest px-4 py-2.5 border-b border-outline-variant/20 flex items-center justify-between no-print">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-primary">{{ "Step {{p1}} of 4:" | translate: { p1: (complete() ? 4 : active()) } }}</span>
        <span class="text-xs text-on-surface font-medium">{{ steps[(complete() ? 4 : active()) - 1].label }}</span>
      </div>
      <div class="w-24 bg-surface-container-high h-1.5 rounded-full overflow-hidden">
        <div class="bg-primary h-full rounded-full transition-all" [style.width.%]="progress()"></div>
      </div>
    </div>
  `,
})
export class WizardHeader {
  protected readonly store = inject(SalonStore);
  protected readonly auth = inject(AuthService);
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly initials = initials;
  protected readonly steps = WIZARD_STEPS;

  readonly active = input(1);
  readonly complete = input(false);
  protected readonly progress = computed(() => (this.complete() ? 100 : this.active() * 25));

  saveDraft() {
    this.store.markSaved();
    this.toast.success('Draft saved');
  }

  exit() {
    if (this.store.onboarded()) {
      this.router.navigateByUrl('/owner/dashboard');
    } else {
      this.store.markSaved();
      this.toast.info('Progress saved. Resume setup anytime.');
      this.router.navigateByUrl('/splash');
    }
  }
}
