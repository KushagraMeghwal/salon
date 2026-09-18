import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { LangToggle } from '../../shared/customer/lang-toggle';

/** Mobile frame for the stylist's own app: salon header, two tabs, footer. */
@Component({
  selector: 'app-staff-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LangToggle, TranslatePipe],
  template: `
    <div class="min-h-screen flex flex-col items-center bg-background text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div class="w-full max-w-md bg-surface min-h-screen flex flex-col relative shadow-sm">
        <header class="bg-surface flex justify-between items-center w-full px-space-md py-space-sm sticky top-0 z-40 shadow-sm border-b border-outline-variant backdrop-blur-md bg-surface/95 no-print">
          <div class="flex items-center gap-space-sm min-w-0">
            <div class="w-9 h-9 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined text-xl">content_cut</span></div>
            <div class="min-w-0">
              <h1 class="font-headline-sm text-headline-sm text-on-surface tracking-tight font-extrabold truncate">{{ store.profile().name }}</h1>
              <div class="flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full bg-tertiary-container animate-pulse"></span><span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Chair {{ chair() }} · Live Queue Ready</span></div>
            </div>
          </div>
          <app-lang-toggle />
        </header>

        <div class="flex-1 flex flex-col pb-20"><router-outlet /></div>

        <footer class="bg-surface-container-low border-t border-outline-variant flex flex-col items-center justify-center gap-space-xs py-space-lg px-space-md text-center w-full mb-16 no-print">
          <div class="text-label-md font-label-md text-on-surface-variant font-semibold">Powered by <span class="text-primary">Chairly</span></div>
          <div class="flex items-center gap-4 text-label-sm font-label-sm text-on-surface-variant mt-1"><a class="hover:text-primary" href="#">{{ 'common.privacy' | translate }}</a><span class="text-outline-variant">•</span><a class="hover:text-primary" href="#">{{ 'common.terms' | translate }}</a><span class="text-outline-variant">•</span><a class="hover:text-primary" href="#">{{ 'common.support' | translate }}</a></div>
        </footer>

        <nav aria-label="Bottom Navigation" class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 flex justify-around items-center px-space-sm py-space-xs bg-surface-container-lowest/95 backdrop-blur-md shadow-md border-t border-outline-variant no-print">
          @for (n of nav; track n.path) {
            <a [routerLink]="n.path" routerLinkActive #rla="routerLinkActive" class="flex flex-col items-center justify-center py-1 px-5 rounded-xl transition-transform active:scale-95 duration-150" [class]="rla.isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'">
              <span class="material-symbols-outlined text-2xl" [style.font-variation-settings]="rla.isActive ? '\\'FILL\\' 1' : null">{{ n.icon }}</span>
              <span class="text-label-sm font-label-sm mt-0.5">{{ n.key | translate }}</span>
            </a>
          }
        </nav>
      </div>
    </div>
  `,
})
export class StaffShell {
  protected readonly store = inject(SalonStore);
  private readonly auth = inject(AuthService);
  protected readonly nav = [
    { path: '/staff/today', icon: 'calendar_today', key: 'nav.myToday' },
    { path: '/staff/earnings', icon: 'payments', key: 'nav.earnings' },
    { path: '/staff/profile', icon: 'person', key: 'nav.profile' },
  ];
  protected chair() {
    return this.store.staff().findIndex((s) => s.id === this.auth.staffId()) + 1 || 1;
  }
}
