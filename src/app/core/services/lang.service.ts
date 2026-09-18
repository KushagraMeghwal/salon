import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { bindTranslator } from '../utils/i18n';
import { LOCALE } from '../utils/time';

const KEY = 'chairly.lang';

/** English / Hindi runtime switch used by the customer and staff apps. */
@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly translate = inject(TranslateService);
  readonly lang = signal<'en' | 'hi'>('en');

  constructor() {
    bindTranslator(this.translate);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch { /* storage unavailable */ }
    this.set(saved === 'hi' ? 'hi' : 'en');
  }

  set(lang: 'en' | 'hi') {
    this.lang.set(lang);
    this.translate.use(lang).subscribe(() => LOCALE.set(lang === 'hi' ? 'hi-IN' : 'en-IN'));
    try {
      localStorage.setItem(KEY, lang);
    } catch { /* ignore */ }
  }

  toggle() {
    this.set(this.lang() === 'en' ? 'hi' : 'en');
  }
}
