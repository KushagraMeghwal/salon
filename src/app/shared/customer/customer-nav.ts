import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-customer-nav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <nav aria-label="Bottom Navigation" class="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-space-sm py-space-xs bg-surface-container-lowest/90 backdrop-blur-md shadow-md border-t border-outline-variant no-print">
      <a [routerLink]="['/s', store.profile().slug]" routerLinkActive #home="routerLinkActive" [routerLinkActiveOptions]="{ exact: true }" class="flex flex-col items-center justify-center active:scale-95 transition-transform duration-150 py-1 px-3" [class]="home.isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'">
        <span class="material-symbols-outlined text-2xl" [style.font-variation-settings]="home.isActive ? '\\'FILL\\' 1' : null">spa</span>
        <span class="text-label-sm font-label-sm mt-0.5">{{ 'nav.services' | translate }}</span>
      </a>
      <a routerLink="/my/bookings" routerLinkActive #bk="routerLinkActive" class="flex flex-col items-center justify-center active:scale-95 transition-transform duration-150 py-1 px-3" [class]="bk.isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'">
        <span class="material-symbols-outlined text-2xl" [style.font-variation-settings]="bk.isActive ? '\\'FILL\\' 1' : null">calendar_today</span>
        <span class="text-label-sm font-label-sm mt-0.5">{{ 'nav.appointments' | translate }}</span>
        @if (bk.isActive) { <span class="w-1.5 h-1.5 rounded-full bg-primary mt-0.5"></span> }
      </a>
      <button type="button" (click)="profile()" class="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors duration-150 active:scale-95 py-1 px-3">
        <span class="material-symbols-outlined text-2xl">person</span>
        <span class="text-label-sm font-label-sm mt-0.5">{{ (auth.customer() ? 'nav.profile' : 'nav.signIn') | translate }}</span>
      </button>
    </nav>
  `,
})
export class CustomerNav {
  protected readonly store = inject(SalonStore);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  profile() {
    if (this.auth.customer()) {
      this.auth.logoutCustomer();
      this.toast.info('Signed out');
      this.router.navigate(['/s', this.store.profile().slug]);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
