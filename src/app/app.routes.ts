import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'splash' },
  { path: 'splash', loadComponent: () => import('./features/splash/splash').then((m) => m.Splash) },
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
          { path: 'staff', loadComponent: () => import('./features/owner/staff/staff-performance').then((m) => m.StaffPerformance) },
          { path: 'reports', loadComponent: () => import('./features/owner/reports/reports').then((m) => m.Reports) },
          { path: 'settings', loadComponent: () => import('./features/owner/settings/settings').then((m) => m.OwnerSettings) },
        ],
      },
    ],
  },
  {
    path: 'admin',
    // Mock phase: owners may open the admin panel to review it. Real guard = superadmin only.
    canActivate: [roleGuard('superadmin', 'owner')],
    loadComponent: () => import('./features/admin/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', loadComponent: () => import('./features/admin/overview').then((m) => m.AdminOverview) },
      { path: 'salons', loadComponent: () => import('./features/admin/salons').then((m) => m.AdminSalons) },
      { path: 'plans', loadComponent: () => import('./features/admin/plans').then((m) => m.AdminPlans) },
    ],
  },
  {
    // Mock phase: owners may open the stylist app to review it.
    path: 'staff',
    canActivate: [roleGuard('staff', 'owner')],
    loadComponent: () => import('./features/staff/staff-shell').then((m) => m.StaffShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      { path: 'today', loadComponent: () => import('./features/staff/today-page').then((m) => m.TodayPage) },
      { path: 'earnings', loadComponent: () => import('./features/staff/earnings-page').then((m) => m.EarningsPage) },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./features/customer/customer-shell').then((m) => m.CustomerShell),
    children: [
      {
        path: 's/:slug',
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
    ],
  },
  { path: '**', redirectTo: 'splash' },
];
