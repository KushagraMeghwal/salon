import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { ProfileView } from '../../shared/customer/profile-view';

@Component({
  selector: 'app-staff-profile',
  imports: [ProfileView],
  template: `<app-profile-view [name]="me()?.name ?? ''" [phone]="me()?.phone ?? ''" [subtitle]="me()?.title || me()?.role || ''" (logout)="logout()" />`,
})
export class StaffProfile {
  private readonly store = inject(SalonStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly me = computed(() => this.store.staffById(this.auth.staffId()));

  logout() {
    this.router.navigate(['/splash']);
  }
}
