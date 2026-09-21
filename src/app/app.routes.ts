import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import { salonGuard } from './core/guards/salon.guard';

export const routes: Routes = [
  // First screen: owner / platform-admin sign-in. Customers arrive through a salon's own link (/s/:slug).
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/auth/owner-login').then((m) => m.OwnerLogin) },
  { path: 'splash', loadComponent: () => import('./features/splash/splash').then((m) => m.Splash) },
  { path: 'not-found', loadComponent: () => import('./features/customer/not-found').then((m) => m.NotFound) },
  {
    path: 'owner',
    canActivate: [roleGuard('owner')],
    children: [
      {
        path: 'onboarding',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'salon' },
          { path: 'salon', loadComponent: () => import('./features/owner/onboarding/salon-step').then((m) => m.SalonStep) },
          { path: 'services', loadComponent: () => import('./features/owner/onboarding/services-step').then((m) => m.ServicesStep) },
          { path: 'timings', loadComponent: () => import('./features/owner/onboarding/timings-step').then((m) => m.TimingsStep) },
          { path: 'staff', loadComponent: () => import('./features/owner/onboarding/staff-step').then((m) => m.StaffStep) },
          { path: 'done', loadComponent: () => import('./features/owner/onboarding/done').then((m) => m.SetupDone) },
        ],
      },
      {
        path: '',
        loadComponent: () => import('./features/owner/shell/owner-shell').then((m) => m.OwnerShell),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'dashboard', loadComponent: () => import('./features/owner/dashboard/dashboard').then((m) => m.Dashboard) },
          { path: 'calendar', loadComponent: () => import('./features/owner/calendar/calendar').then((m) => m.CalendarPage) },
          { path: 'quick-bill', loadComponent: () => import('./features/owner/quick-bill/quick-bill').then((m) => m.QuickBill) },
          { path: 'customers', loadComponent: () => import('./features/owner/customers/customers').then((m) => m.OwnerCustomers) },
          { path: 'staff', loadComponent: () => import('./features/owner/staff/staff-performance').then((m) => m.StaffPerformance) },
          { path: 'qr', loadComponent: () => import('./features/owner/qr/qr-page').then((m) => m.QrPage) },
          { path: 'reports', loadComponent: () => import('./features/owner/reports/reports').then((m) => m.Reports) },
          { path: 'settings', loadComponent: () => import('./features/owner/settings/settings').then((m) => m.OwnerSettings) },
        ],
      },
    ],
  },
  {
    // Platform admin only (the Firebase token must carry the superadmin claim).
    path: 'admin',
    canActivate: [roleGuard('superadmin')],
    loadComponent: () => import('./features/admin/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', loadComponent: () => import('./features/admin/overview').then((m) => m.AdminOverview) },
      { path: 'salons', loadComponent: () => import('./features/admin/salons').then((m) => m.AdminSalons) },
      { path: 'plans', loadComponent: () => import('./features/admin/plans').then((m) => m.AdminPlans) },
    ],
  },
  { path: 'staff/login', loadComponent: () => import('./features/auth/staff-login').then((m) => m.StaffLogin) },
  {
    path: 'staff',
    canActivate: [roleGuard('staff')],
    loadComponent: () => import('./features/staff/staff-shell').then((m) => m.StaffShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      { path: 'today', loadComponent: () => import('./features/staff/today-page').then((m) => m.TodayPage) },
      { path: 'earnings', loadComponent: () => import('./features/staff/earnings-page').then((m) => m.EarningsPage) },
      { path: 'profile', loadComponent: () => import('./features/staff/profile-page').then((m) => m.StaffProfile) },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./features/customer/customer-shell').then((m) => m.CustomerShell),
    children: [
      {
        path: 's/:slug',
        canActivate: [salonGuard],
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./features/customer/home').then((m) => m.CustomerHome) },
          { path: 'services', loadComponent: () => import('./features/customer/services-page').then((m) => m.ServicesPage) },
          { path: 'slot', loadComponent: () => import('./features/customer/slot-page').then((m) => m.SlotPage) },
          { path: 'stylist', loadComponent: () => import('./features/customer/stylist-page').then((m) => m.StylistPage) },
          { path: 'pay', loadComponent: () => import('./features/customer/pay-page').then((m) => m.PayPage) },
        ],
      },
      { path: 'login', loadComponent: () => import('./features/customer/login-page').then((m) => m.LoginPage) },
      { path: 'my/bookings', loadComponent: () => import('./features/customer/my-bookings').then((m) => m.MyBookings) },
      { path: 'my/profile', loadComponent: () => import('./features/customer/profile-page').then((m) => m.CustomerProfile) },
    ],
  },
  { path: '**', redirectTo: 'not-found' },
];
