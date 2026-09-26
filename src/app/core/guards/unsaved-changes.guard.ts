import { CanDeactivateFn } from '@angular/router';
import { tr } from '../utils/i18n';

/** Pages with a draft + Save button implement this so navigating away cannot silently drop edits. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (page) =>
  !page?.hasUnsavedChanges?.() || confirm(tr('You have unsaved changes. Leave this page and discard them?'));
