import { Component, inject } from '@angular/core';
import { LangService } from '../../core/services/lang.service';
import { SalonStore } from '../../core/services/salon.store';

/** EN / हिं switch. Hidden when the salon turned Hindi support off in Settings. */
@Component({
  selector: 'app-lang-toggle',
  template: `
    @if (store.settings().hindiSupport) {
      <button
        type="button"
        (click)="lang.toggle()"
        class="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full border border-outline-variant bg-surface-container-lowest text-label-md font-label-md hover:bg-surface-container-low transition-colors duration-150 active:scale-95"
        [attr.aria-label]="lang.lang() === 'en' ? 'Switch to Hindi' : 'Switch to English'"
      >
        <span class="material-symbols-outlined text-[16px] text-primary">translate</span>
        <span [class]="lang.lang() === 'hi' ? 'font-bold text-primary' : 'text-on-surface-variant'">हिं</span>
        <span class="text-outline-variant">|</span>
        <span [class]="lang.lang() === 'en' ? 'font-bold text-primary' : 'text-on-surface-variant'">EN</span>
      </button>
    }
  `,
})
export class LangToggle {
  protected readonly lang = inject(LangService);
  protected readonly store = inject(SalonStore);
}
