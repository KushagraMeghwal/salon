import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const KEY = 'chairly.lang';

/** English / Hindi runtime switch used by the customer and staff apps. */
@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly translate = inject(TranslateService);
  readonly lang = signal<'en' | 'hi'>('en');

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch { /* storage unavailable */ }
    this.set(saved === 'hi' ? 'hi' : 'en');
  }

  set(lang: 'en' | 'hi') {
    this.lang.set(lang);
    this.translate.use(lang);
    try {
      localStorage.setItem(KEY, lang);
    } catch { /* ignore */ }
  }

  toggle() {
    this.set(this.lang() === 'en' ? 'hi' : 'en');
  }
}
