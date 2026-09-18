import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

type Params = Record<string, string | number | null | undefined>;

/** Messages are English keys; `{{name}}` placeholders are filled from `params` and the result is translated. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly translate = inject(TranslateService);
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  success(message: string, params?: Params) { this.push('success', message, params); }
  error(message: string, params?: Params) { this.push('error', message, params); }
  info(message: string, params?: Params) { this.push('info', message, params); }

  dismiss(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  /** Params named `t_*` hold English keys of their own (e.g. a status label) and are translated first. */
  private resolve(params?: Params) {
    if (!params) return params;
    return Object.fromEntries(Object.entries(params).map(([k, v]) => [k.startsWith('t_') ? k.slice(2) : k, k.startsWith('t_') ? this.translate.instant(String(v)) : v]));
  }

  private push(kind: Toast['kind'], message: string, params?: Params) {
    const id = ++this.seq;
    const text = this.translate.instant(message, this.resolve(params));
    this.toasts.update((t) => [...t, { id, kind, message: text }]);
    setTimeout(() => this.dismiss(id), 3200);
  }
}
