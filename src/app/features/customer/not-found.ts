import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslatePipe],
  template: `
    <main class="min-h-dvh flex items-center justify-center bg-[#F7FAF9] px-6 py-10">
      <div class="max-w-sm text-center flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-6xl text-primary/40">{{ offline ? 'cloud_off' : 'storefront' }}</span>
        <h1 class="text-headline-lg font-headline-lg font-bold text-on-surface">{{ (offline ? 'We could not load this page' : 'This salon page was not found') | translate }}</h1>
        <p class="text-body-md text-on-surface-variant">{{ (offline ? 'Check your internet connection and try again.' : 'The link may be wrong, or the salon is not taking bookings right now.') | translate }}</p>
        <a routerLink="/my/bookings" class="mt-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg font-semibold">{{ 'My bookings' | translate }}</a>
        <p class="text-label-sm text-outline mt-4">{{ "Powered by Chairly" | translate }}</p>
      </div>
    </main>
  `,
})
export class NotFound {
  protected readonly offline = inject(ActivatedRoute).snapshot.queryParamMap.get('reason') === 'offline';
}
