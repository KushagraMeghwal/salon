import { Component, inject } from '@angular/core';
import { LangService } from './core/services/lang.service';
import { RouterOutlet } from '@angular/router';
import { PwaOverlays } from './shared/ui/pwa-overlays';
import { RouteProgress } from './shared/ui/route-progress';
import { ToastOutlet } from './shared/ui/toast-outlet';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastOutlet, RouteProgress, PwaOverlays],
  template: `
    <app-route-progress />
    <router-outlet />
    <app-toast-outlet />
    <app-pwa-overlays />
  `,
})
export class App {
  // Instantiated at startup so the saved EN/हिं choice is applied before any page renders.
  private readonly lang = inject(LangService);
}
