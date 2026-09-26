import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PwaService } from '../../core/services/pwa.service';

/** App-wide PWA surfaces: iPhone "Add to Home Screen" steps and the "new version ready" bar. */
@Component({
  selector: 'app-pwa-overlays',
  imports: [TranslatePipe],
  template: `
    @if (pwa.iosHelp()) {
      <div class="fixed inset-0 z-[60] bg-inverse-surface/50 backdrop-blur-sm flex items-end sm:items-center justify-center no-print" (click)="pwa.iosHelp.set(false)">
        <div role="dialog" aria-modal="true" [attr.aria-label]="'Install on iPhone' | translate" (click)="$event.stopPropagation()"
          class="w-full sm:max-w-sm bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl">
          <div class="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-5 sm:hidden"></div>
          <div class="flex items-center gap-3 mb-5">
            <img src="icons/icon-192.png" alt="" class="w-12 h-12 rounded-xl" />
            <div>
              <p class="font-headline-sm text-headline-sm text-on-surface font-semibold">{{ 'Install on iPhone' | translate }}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">{{ 'Two quick steps in Safari' | translate }}</p>
            </div>
          </div>
          <ol class="space-y-4">
            <li class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-full bg-primary/10 text-primary font-label-md text-label-md font-bold flex items-center justify-center shrink-0">1</span>
              <span class="font-body-md text-body-md text-on-surface flex items-center gap-1.5 flex-wrap">{{ 'Tap the Share button' | translate }} <span class="material-symbols-outlined text-primary text-[22px]">ios_share</span> {{ 'in the toolbar' | translate }}</span>
            </li>
            <li class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-full bg-primary/10 text-primary font-label-md text-label-md font-bold flex items-center justify-center shrink-0">2</span>
              <span class="font-body-md text-body-md text-on-surface flex items-center gap-1.5 flex-wrap">{{ 'Choose' | translate }} <strong class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[20px]">add_box</span>{{ 'Add to Home Screen' | translate }}</strong></span>
            </li>
          </ol>
          <button type="button" (click)="pwa.iosHelp.set(false)" class="mt-6 w-full py-3 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold active:scale-[0.98] transition-all">{{ 'Got it' | translate }}</button>
        </div>
      </div>
    }

    @if (pwa.updateReady()) {
      <div role="status" class="fixed z-[55] top-[calc(0.75rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md no-print">
        <div class="bg-inverse-surface text-inverse-on-surface rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
          <span class="material-symbols-outlined text-inverse-primary">system_update</span>
          <span class="flex-1 font-body-sm text-body-sm">{{ 'A new version of Chairly is ready.' | translate }}</span>
          <button type="button" (click)="pwa.applyUpdate()" class="px-3 py-1.5 rounded-lg bg-inverse-primary text-on-primary-fixed font-label-md text-label-md font-semibold">{{ 'Update' | translate }}</button>
        </div>
      </div>
    }
  `,
})
export class PwaOverlays {
  protected readonly pwa = inject(PwaService);
}
