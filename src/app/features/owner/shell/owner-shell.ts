import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BookingModal } from '../../../shared/layout/booking-modal';
import { OwnerSidebar } from '../../../shared/layout/owner-sidebar';
import { WalkinModal } from '../../../shared/layout/walkin-modal';
import { InstallBanner } from '../../../shared/ui/install-banner';

@Component({
  selector: 'app-owner-shell',
  imports: [RouterOutlet, OwnerSidebar, BookingModal, WalkinModal, InstallBanner],
  template: `
    <app-owner-sidebar />
    <router-outlet />
    <app-booking-modal />
    <app-walkin-modal />
    <app-install-banner audience="owner" />
  `,
})
export class OwnerShell {}
