import { Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';
import { SalonStore } from '../../core/services/salon.store';
import { CustomerNav } from '../../shared/customer/customer-nav';
import { LangToggle } from '../../shared/customer/lang-toggle';

/** Mobile-first frame for every customer page: salon header, footer, optional bottom nav. */
@Component({
  selector: 'app-customer-shell',
  imports: [RouterOutlet, CustomerNav, LangToggle, TranslatePipe],
  template: `
    <div class="theme-v2 min-h-screen flex flex-col bg-background text-on-surface antialiased selection:bg-primary selection:text-on-primary">
      <header class="bg-surface border-b border-outline-variant shadow-sm w-full sticky top-0 z-40 no-print">
        <div class="flex justify-between items-center w-full px-space-md py-space-sm max-w-screen-md mx-auto">
          <div class="flex items-center gap-space-sm min-w-0">
            @if (showBack()) {
              <button type="button" aria-label="Go back" (click)="location.back()" class="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low active:scale-95 transition-all">
                <span class="material-symbols-outlined text-[22px]">arrow_back</span>
              </button>
            }
            <div class="text-headline-sm font-headline-sm text-on-surface flex items-center gap-space-xs font-bold tracking-tight min-w-0">
              @if (store.profile().logo; as logo) {
                <img [src]="logo" [alt]="store.profile().name" class="w-7 h-7 rounded-lg object-contain bg-white border border-outline-variant/40 shrink-0" />
              } @else {
                <span class="material-symbols-outlined text-primary text-[22px]">content_cut</span>
              }
              <span class="truncate">{{ store.profile().name }}</span>
            </div>
          </div>
          <app-lang-toggle />
        </div>
      </header>

      <div class="flex-1 flex flex-col" [class.pb-20]="showNav()">
        <router-outlet />
      </div>

      <footer class="bg-surface-container-low border-t border-outline-variant py-space-lg px-space-md text-center w-full no-print" [class.mb-16]="showNav()">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center gap-space-xs">
          <div class="text-label-md font-label-md text-on-surface-variant font-medium">Powered by <span class="font-semibold text-primary">Chairly</span></div>
          <div class="flex items-center gap-space-md text-label-sm font-label-sm text-outline">
            <a class="hover:text-primary hover:underline transition-all duration-150" href="#privacy">{{ 'common.privacy' | translate }}</a><span>•</span>
            <a class="hover:text-primary hover:underline transition-all duration-150" href="#terms">{{ 'common.terms' | translate }}</a><span>•</span>
            <a class="hover:text-primary hover:underline transition-all duration-150" href="#support">{{ 'common.support' | translate }}</a>
          </div>
        </div>
      </footer>
      @if (showNav()) { <app-customer-nav /> }
    </div>
  `,
})
export class CustomerShell {
  protected readonly store = inject(SalonStore);
  protected readonly location = inject(Location);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects.split('?')[0]), startWith(this.router.url.split('?')[0])),
    { initialValue: '/' },
  );
  protected readonly showBack = computed(() => /^\/s\/[^/]+\/(services|slot|stylist|pay)$/.test(this.url()) || this.url() === '/login');
  protected readonly showNav = computed(() => /^\/s\/[^/]+$/.test(this.url()) || this.url() === '/my/bookings');
}
