import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SetupHealthService } from '../../core/services/setup-health.service';

/** Lists setup problems that would break or empty the customer booking page, each with a link to the screen that fixes it. */
@Component({
  selector: 'app-health-banner',
  imports: [RouterLink],
  template: `
    @if (health.issues().length; as n) {
      <section id="setup-health" class="rounded-[16px] border shadow-level-1 overflow-hidden" [class]="health.errorCount() ? 'border-error/40 bg-error-container/30' : 'border-secondary/40 bg-secondary-fixed/40'" role="alert">
        <button type="button" (click)="open.set(!open())" class="w-full flex items-center gap-3 px-4 py-3 text-left" [attr.aria-expanded]="open()">
          <span class="material-symbols-outlined text-[24px]" [class]="health.errorCount() ? 'text-error' : 'text-secondary'">{{ health.errorCount() ? 'error' : 'warning' }}</span>
          <span class="flex-1 min-w-0">
            <span class="block font-headline-sm text-headline-sm text-on-surface">{{ health.errorCount() ? 'Customers may not be able to book' : 'Setup needs attention' }}</span>
            <span class="block font-body-sm text-body-sm text-on-surface-variant">{{ n }} issue{{ n > 1 ? 's' : '' }} found in your salon setup. Fix {{ n > 1 ? 'them' : 'it' }} so the booking page shows slots.</span>
          </span>
          <span class="material-symbols-outlined text-on-surface-variant">{{ open() ? 'expand_less' : 'expand_more' }}</span>
        </button>
        @if (open()) {
          <ul class="border-t border-outline-variant/30 divide-y divide-outline-variant/30 bg-surface-container-lowest/70">
            @for (i of health.issues(); track i.id) {
              <li class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3">
                <span class="material-symbols-outlined text-[20px] shrink-0" [class]="i.level === 'error' ? 'text-error' : 'text-secondary'">{{ i.level === 'error' ? 'cancel' : 'warning' }}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-label-lg text-label-lg text-on-surface font-semibold">{{ i.title }}</p>
                  <p class="font-body-sm text-body-sm text-on-surface-variant">{{ i.detail }}</p>
                </div>
                <a [routerLink]="i.link" class="self-start sm:self-auto shrink-0 px-3 py-1.5 rounded-xl border border-primary/30 text-primary font-label-md text-label-md hover:bg-primary/10 transition-colors">{{ i.action }}</a>
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
})
export class HealthBanner {
  protected readonly health = inject(SetupHealthService);
  protected readonly open = signal(true);
}
