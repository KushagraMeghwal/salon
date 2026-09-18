import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { ProfileView } from '../../shared/customer/profile-view';

@Component({
  selector: 'app-customer-profile',
  imports: [ProfileView],
  template: `<app-profile-view [name]="auth.customer()?.name ?? ''" [phone]="phone()" (logout)="logout()" />`,
})
export class CustomerProfile {
  protected readonly auth = inject(AuthService);
  private readonly store = inject(SalonStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  constructor() {
    if (!this.auth.customer()) this.router.navigate(['/login']);
  }

  protected phone() {
    const p = this.auth.customer()?.phone ?? '';
    return p ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : '';
  }

  logout() {
    this.auth.logoutCustomer();
    this.toast.info('Signed out');
    this.router.navigate(['/s', this.store.profile().slug]);
  }
}
