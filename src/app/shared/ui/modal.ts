import { TranslatePipe } from '@ngx-translate/core';
import { Component, HostListener, input, output } from '@angular/core';

@Component({
  imports: [TranslatePipe],
  selector: 'app-modal',
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-inverse-surface/40 backdrop-blur-sm sm:p-4 no-print" (click)="closed.emit()">
        <div
          class="bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl w-full p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-xl border border-outline-variant/20 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto"
          [class]="wide() ? 'max-w-2xl' : 'max-w-lg'"
          role="dialog"
          aria-modal="true"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between pb-4 border-b border-outline-variant/20">
            <h3 class="text-headline-sm font-headline-sm text-on-surface">{{ title() }}</h3>
            <button type="button" class="text-muted hover:text-on-surface p-1 rounded-lg" (click)="closed.emit()" [attr.aria-label]="'Close' | translate">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="mt-4"><ng-content /></div>
        </div>
      </div>
    }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly title = input('');
  readonly wide = input(false);
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open()) this.closed.emit();
  }
}
