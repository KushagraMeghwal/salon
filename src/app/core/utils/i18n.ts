import { TranslateService } from '@ngx-translate/core';
import { LOCALE } from './time';

let translator: TranslateService | undefined;

/** Called once by LangService so plain functions (not just templates) can translate. */
export function bindTranslator(t: TranslateService) {
  translator = t;
}

/**
 * Translate an English key from TypeScript. Reading LOCALE() makes callers inside
 * computed()/templates re-run when the language changes.
 */
export function tr(key: string, params?: Record<string, string | number>): string {
  LOCALE();
  return translator ? translator.instant(key, params) : key;
}
