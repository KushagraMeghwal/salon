import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { UiService } from '../../core/services/ui.service';
import { initials } from '../../core/utils/time';
import { SalonMark } from './salon-mark';

@Component({
  selector: 'app-owner-sidebar',
  imports: [RouterLink, RouterLinkActive, SalonMark],
  template: `
    @if (ui.navOpen()) {
      <div class="fixed inset-0 z-30 bg-inverse-surface/40 lg:hidden no-print" (click)="ui.navOpen.set(false)"></div>
    }
    <aside
      class="w-64 h-screen fixed left-0 top-0 z-40 flex flex-col justify-between p-4 bg-surface-container-lowest border-r border-outline-variant/30 shadow-sm transition-transform duration-200 lg:translate-x-0"
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
          <span>New Appointment</span>
        </button>

        <nav aria-label="Main Navigation" class="flex flex-col gap-1.5">
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
              <span>{{ n.label }}</span>
            </a>
          }
        </nav>
      </div>

      <div class="pt-4 border-t border-outline-variant/30 flex flex-col gap-2">
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-container transition-colors">
          <div class="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-headline-sm text-label-lg shrink-0">{{ initials(auth.user().name) }}</div>
          <div class="flex flex-col text-left overflow-hidden">
            <span class="font-label-lg text-label-lg truncate text-on-surface">{{ auth.user().name }}</span>
            <span class="font-label-sm text-label-sm text-outline truncate">{{ auth.user().title }}</span>
          </div>
        </div>
        <p class="px-3 text-[11px] text-outline">Powered by <span class="font-semibold text-primary">Chairly</span></p>
      </div>
    </aside>
  `,
})
export class OwnerSidebar {
  protected readonly store = inject(SalonStore);
  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiService);
  protected readonly initials = initials;
  protected readonly nav = [
    { path: '/owner/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/owner/calendar', label: 'Calendar', icon: 'calendar_today' },
    { path: '/owner/quick-bill', label: 'Quick Bill', icon: 'point_of_sale' },
    { path: '/owner/customers', label: 'Customers', icon: 'groups' },
    { path: '/owner/staff', label: 'Staff', icon: 'badge' },
    { path: '/owner/reports', label: 'Reports', icon: 'analytics' },
    { path: '/owner/settings', label: 'Settings', icon: 'settings' },
  ];
}
