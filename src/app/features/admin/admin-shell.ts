import { TranslatePipe } from '@ngx-translate/core';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LangToggle } from '../../shared/customer/lang-toggle';

const NAV = [
  { path: '/admin/overview', label: 'Overview', icon: 'space_dashboard' },
  { path: '/admin/salons', label: 'Salons', icon: 'storefront' },
  { path: '/admin/plans', label: 'Plans', icon: 'workspace_premium' },
];

@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe, LangToggle],
  template: `
    @if (open()) { <div class="fixed inset-0 z-30 bg-inverse-surface/40 lg:hidden" (click)="open.set(false)"></div> }
    <aside class="w-64 h-screen fixed left-0 top-0 z-40 flex flex-col justify-between p-4 bg-surface-container-lowest border-r border-outline-variant/30 shadow-sm transition-transform duration-200 lg:translate-x-0" [class.-translate-x-full]="!open()">
      <div class="flex flex-col gap-6">
        <div class="flex items-center gap-3 px-2 py-1">
          <div class="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary-container text-on-primary flex items-center justify-center"><span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">admin_panel_settings</span></div>
          <div class="flex flex-col"><span class="font-headline-md text-headline-md font-bold text-primary tracking-tight leading-tight">{{ "Chairly" | translate }}</span><span class="font-label-sm text-label-sm text-outline font-medium tracking-wide">{{ "Super Admin" | translate }}</span></div>
        </div>
        <nav [attr.aria-label]="'Admin navigation' | translate" class="flex flex-col gap-1.5">
          @for (n of nav; track n.path) {
            <a [routerLink]="n.path" routerLinkActive #rla="routerLinkActive" (click)="open.set(false)" class="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-lg text-label-lg transition-colors" [class]="rla.isActive ? 'bg-primary/10 text-primary border-l-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'">
              <span class="material-symbols-outlined" [style.font-variation-settings]="rla.isActive ? '\\'FILL\\' 1' : null">{{ n.icon }}</span><span>{{ (n.label) | translate }}</span>
            </a>
          }
        </nav>
      </div>
      <div class="pt-4 border-t border-outline-variant/30 flex flex-col gap-2">
        <div class="flex items-center gap-3 px-3 py-2">
          <div class="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-label-lg text-label-lg shrink-0">{{ auth.profile().name.slice(0, 2).toUpperCase() }}</div>
          <div class="flex flex-col overflow-hidden"><span class="font-label-lg text-label-lg truncate text-on-surface">{{ auth.profile().name }}</span><span class="font-label-sm text-label-sm text-outline truncate">{{ auth.profile().email }}</span></div>
        </div>
        <button type="button" (click)="logout()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-lg text-label-lg text-error hover:bg-error-container/40 transition-colors"><span class="material-symbols-outlined">logout</span><span>{{ 'Log out' | translate }}</span></button>
      </div>
    </aside>

    <header class="h-16 fixed top-0 right-0 left-0 lg:left-64 z-30 flex items-center gap-3 px-4 md:px-6 bg-surface-container-lowest border-b border-outline-variant/30">
      <button type="button" class="lg:hidden p-2 -ml-2 rounded-lg text-on-surface-variant hover:bg-surface-container" [attr.aria-label]="'Open menu' | translate" (click)="open.set(true)"><span class="material-symbols-outlined">menu</span></button>
      <span class="font-headline-sm text-headline-sm text-on-surface">{{ "Platform Control Center" | translate }}</span>
      <span class="ml-auto hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm"><span class="w-2 h-2 rounded-full bg-primary animate-pulse-dot"></span> {{ "All systems normal" | translate }}</span>
      <app-lang-toggle [always]="true" />
    </header>

    <main class="lg:pl-64 pt-16 min-h-screen bg-background"><router-outlet /></main>
  `,
})
export class AdminShell {
  protected readonly auth = inject(AuthService);
  protected readonly nav = NAV;
  protected readonly open = signal(false);
  private readonly router = inject(Router);

  async logout() {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
