import { Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PwaService } from '../../core/services/pwa.service';

/**
 * Always-available install entry point (sidebar / profile), unlike the banner which can be snoozed.
 * Renders nothing when the app is already installed or this browser cannot install it.
 */
@Component({
  selector: 'app-install-button',
  imports: [TranslatePipe],
  template: `
    @if (pwa.canInstall()) {
      @switch (variant()) {
        @case ('nav') {
          <button type="button" (click)="pwa.install()" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-lg text-label-lg text-primary hover:bg-primary/10 transition-colors">
            <span class="material-symbols-outlined">install_mobile</span><span>{{ 'Install app' | translate }}</span>
          </button>
        }
        @default {
          <section class="bg-surface-container-lowest rounded-2xl border border-primary/30 shadow-level-1 p-space-md flex items-center gap-space-md">
            <img src="icons/icon-192.png" alt="" class="w-12 h-12 rounded-xl shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="font-label-lg text-label-lg text-on-surface font-semibold">{{ 'Install the Chairly app' | translate }}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">{{ 'One tap from your home screen. No app store needed.' | translate }}</p>
            </div>
            <button type="button" (click)="pwa.install()" class="shrink-0 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold active:scale-[0.98] transition-all">{{ 'Install' | translate }}</button>
          </section>
        }
      }
    } @else if (pwa.installed() && variant() === 'card') {
      <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 p-space-md flex items-center gap-3 text-on-surface-variant">
        <span class="material-symbols-outlined text-tertiary">check_circle</span>
        <span class="font-body-md text-body-md">{{ 'You are using the installed app.' | translate }}</span>
      </section>
    }
  `,
})
export class InstallButton {
  protected readonly pwa = inject(PwaService);
  readonly variant = input<'nav' | 'card'>('card');
}
