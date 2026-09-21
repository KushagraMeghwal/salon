import { TranslatePipe } from '@ngx-translate/core';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { UiService } from '../../core/services/ui.service';
import { initials } from '../../core/utils/time';
import { SalonMark } from './salon-mark';

@Component({
  selector: 'app-owner-sidebar',
  imports: [RouterLink, RouterLinkActive, SalonMark, TranslatePipe],
  template: `
    @if (ui.navOpen()) {
      <div class="fixed inset-0 z-30 bg-inverse-surface/40 lg:hidden no-print" (click)="ui.navOpen.set(false)"></div>
    }
    <aside
      class="print:hidden w-64 max-w-[85vw] h-dvh overflow-y-auto fixed left-0 top-0 z-40 flex flex-col justify-between gap-4 p-4 bg-surface-container-lowest border-r border-outline-variant/30 shadow-sm transition-transform duration-200 lg:translate-x-0"
      [class.-translate-x-full]="!ui.navOpen()"
    >
      <div class="flex flex-col gap-6">
        <div class="flex items-center gap-3 px-2 py-1">
          <app-salon-mark size="md" />
          <div class="flex flex-col min-w-0">
            <span class="font-headline-md text-headline-md font-bold text-primary tracking-tight leading-tight truncate">{{ store.profile().name }}</span>
            <span class="font-label-sm text-label-sm text-outline font-medium tracking-wide truncate">{{ store.profile().city }}</span>
          </div>
        </div>

        <button
          type="button"
          (click)="ui.openBooking(); ui.navOpen.set(false)"
          class="w-full bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-[0.98]"
        >
          <span class="material-symbols-outlined text-[18px]">add_circle</span>
          <span>{{ "New Appointment" | translate }}</span>
        </button>

        <nav [attr.aria-label]="'Main Navigation' | translate" class="flex flex-col gap-1.5">
          @for (n of nav; track n.path) {
            <a
              [routerLink]="n.path"
              routerLinkActive
              #rla="routerLinkActive"
              (click)="ui.navOpen.set(false)"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-lg text-label-lg transition-colors active:scale-[0.98]"
              [class]="
                rla.isActive
                  ? 'bg-primary/10 text-primary border-l-4 border-primary'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              "
            >
              <span class="material-symbols-outlined" [style.font-variation-settings]="rla.isActive ? '\\'FILL\\' 1' : null">{{ n.icon }}</span>
              <span>{{ (n.label) | translate }}</span>
            </a>
          }
        </nav>
      </div>

      <div class="pt-4 border-t border-outline-variant/30 flex flex-col gap-2">
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div class="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-headline-sm text-label-lg shrink-0">{{ initials(auth.profile().name) }}</div>
          <div class="flex flex-col text-left overflow-hidden">
            <span class="font-label-lg text-label-lg truncate text-on-surface">{{ auth.profile().name }}</span>
            <span class="font-label-sm text-label-sm text-outline truncate">{{ (auth.profile().title) | translate }}</span>
          </div>
        </div>
        @if (store.profile().slug) {
          <a [routerLink]="['/s', store.profile().slug]" target="_blank" class="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"><span class="material-symbols-outlined">open_in_new</span><span>{{ 'Open booking page' | translate }}</span></a>
        }
        <button type="button" (click)="logout()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-lg text-label-lg text-error hover:bg-error-container/40 transition-colors"><span class="material-symbols-outlined">logout</span><span>{{ 'Log out' | translate }}</span></button>
        <p class="px-3 text-[11px] text-outline">{{ "Powered by" | translate }} <span class="font-semibold text-primary">{{ "Chairly" | translate }}</span></p>
      </div>
    </aside>
  `,
})
export class OwnerSidebar {
  protected readonly store = inject(SalonStore);
  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiService);
  protected readonly initials = initials;
  private readonly router = inject(Router);

  async logout() {
    this.ui.navOpen.set(false);
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
  protected readonly nav = [
    { path: '/owner/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/owner/calendar', label: 'Calendar', icon: 'calendar_today' },
    { path: '/owner/quick-bill', label: 'Quick Bill', icon: 'point_of_sale' },
    { path: '/owner/customers', label: 'Customers', icon: 'groups' },
    { path: '/owner/staff', label: 'Staff', icon: 'badge' },
    { path: '/owner/qr', label: 'QR & Share', icon: 'qr_code_2' },
    { path: '/owner/reports', label: 'Reports', icon: 'analytics' },
    { path: '/owner/settings', label: 'Settings', icon: 'settings' },
  ];
}
