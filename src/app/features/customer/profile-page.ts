import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { ProfileView } from '../../shared/customer/profile-view';

@Component({
  selector: 'app-customer-profile',
  imports: [ProfileView],
  template: `<app-profile-view [name]="auth.customer()?.name ?? ''" [phone]="phone()" [subtitle]="auth.profile().email" (logout)="logout()" />`,
})
export class CustomerProfile implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly store = inject(SalonStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  async ngOnInit() {
    await this.auth.ready;
    if (!this.auth.customer()) this.router.navigate(['/login'], { queryParams: { returnUrl: '/my/profile' }, replaceUrl: true });
  }

  protected phone() {
    const p = this.auth.customer()?.phone ?? '';
    return p ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : '';
  }

  async logout() {
    const slug = this.store.lastSlug();
    await this.auth.signOut();
    this.toast.info('Signed out');
    this.router.navigateByUrl(slug ? `/s/${slug}` : '/login');
  }
}
