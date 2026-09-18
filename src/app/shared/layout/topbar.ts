import { TranslatePipe } from '@ngx-translate/core';
import { Component, inject } from '@angular/core';
import { UiService } from '../../core/services/ui.service';
import { LangToggle } from '../customer/lang-toggle';

/** Fixed top bar frame. Project content with the `left` and `right` attributes. */
@Component({
  selector: 'app-topbar',
  imports: [LangToggle, TranslatePipe],
  template: `
    <header class="h-16 fixed top-0 right-0 left-0 lg:left-64 z-30 flex items-center justify-between px-4 md:px-6 bg-surface-container-lowest border-b border-outline-variant/30 no-print">
      <div class="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
        <button type="button" class="lg:hidden p-2 -ml-2 rounded-lg text-on-surface-variant hover:bg-surface-container" [attr.aria-label]="'Open menu' | translate" (click)="ui.navOpen.set(true)">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <ng-content select="[left]" />
      </div>
      <div class="flex items-center gap-2 md:gap-3 shrink-0">
        <ng-content select="[right]" />
        <app-lang-toggle [always]="true" />
      </div>
    </header>
  `,
})
export class Topbar {
  protected readonly ui = inject(UiService);
}
