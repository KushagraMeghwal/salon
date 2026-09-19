import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService, authMessage } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PhoneOtp } from '../../shared/auth/phone-otp';

/** Stylist sign-in: the mobile number the salon owner saved for them unlocks that salon's stylist app. */
@Component({
  selector: 'app-staff-login',
  imports: [TranslatePipe, PhoneOtp],
  template: `
    <div class="min-h-dvh flex items-center justify-center bg-[#F7FAF9] px-4 py-8">
      <div class="w-full max-w-md bg-surface-container-lowest rounded-2xl p-5 sm:p-8 border border-[#E2ECE9] elevation-1">
        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-label-sm font-label-sm mb-3"><span class="material-symbols-outlined text-[14px]">badge</span><span>{{ "Stylist sign-in" | translate }}</span></div>
        <h1 class="text-headline-lg font-headline-lg font-bold text-on-surface mb-1">{{ "Sign in to your schedule" | translate }}</h1>
        <p class="text-body-md text-on-surface-variant mb-5">{{ "Use the mobile number your salon has on file for you." | translate }}</p>
        <app-phone-otp (verified)="claim()" />
      </div>
    </div>
  `,
})
export class StaffLogin implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  async ngOnInit() {
    await this.auth.ready;
    if (this.auth.user() && this.auth.role() === 'staff') void this.router.navigateByUrl('/staff');
  }

  async claim() {
    try {
      await this.auth.claimStaff();
      await this.router.navigateByUrl('/staff');
    } catch (e) {
      this.toast.error(authMessage(e));
      await this.auth.signOut();
    }
  }
}
