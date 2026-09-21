import { Component, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';

/** Thin top bar shown while a route is resolving (guards load salon/owner data before the page renders). */
@Component({
  selector: 'app-route-progress',
  template: `
    @if (active()) {
      <div class="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-primary/15 overflow-hidden no-print" role="progressbar" aria-label="Loading">
        <div class="absolute top-0 bottom-0 left-0 w-24 bg-linear-to-r from-primary-fixed-dim via-primary to-primary-container rounded-full animate-progress-loading"></div>
      </div>
    }
  `,
})
export class RouteProgress {
  private readonly router = inject(Router);
  protected readonly active = signal(false);

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.active.set(true);
      else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.active.set(false);
    });
  }
}
