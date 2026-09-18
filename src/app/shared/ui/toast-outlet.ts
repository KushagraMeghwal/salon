import { TranslatePipe } from '@ngx-translate/core';
import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  imports: [TranslatePipe],
  selector: 'app-toast-outlet',
  template: `
    <div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 no-print" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div
          class="flex items-center gap-2.5 pl-3.5 pr-2 py-2.5 rounded-xl shadow-level-3 text-label-lg font-label-lg border min-w-64 max-w-sm"
          style="animation: toast-in 0.2s ease-out"
          [class]="
            t.kind === 'success'
              ? 'bg-inverse-surface text-inverse-on-surface border-inverse-surface'
              : t.kind === 'error'
                ? 'bg-error-container text-on-error-container border-error/30'
                : 'bg-surface-container-lowest text-on-surface border-outline-variant/40'
          "
        >
          <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">
            {{ t.kind === 'success' ? 'check_circle' : t.kind === 'error' ? 'error' : 'info' }}
          </span>
          <span class="flex-1">{{ t.message }}</span>
          <button type="button" class="p-1 rounded-lg opacity-70 hover:opacity-100" (click)="toasts.dismiss(t.id)" [attr.aria-label]="'Dismiss' | translate">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastOutlet {
  protected readonly toasts = inject(ToastService);
}
