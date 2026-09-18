import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LangService } from '../../core/services/lang.service';
import { inject } from '@angular/core';
import { initials } from '../../core/utils/time';

/** Minimal profile shared by the customer and stylist apps: name, phone, language, logout. */
@Component({
  selector: 'app-profile-view',
  imports: [TranslatePipe],
  template: `
    <main class="flex-1 w-full max-w-screen-md mx-auto px-space-md pt-space-md pb-space-lg flex flex-col gap-space-md">
      <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">{{ 'Profile' | translate }}</h1>

      <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-level-1 p-space-md flex items-center gap-space-md">
        <div class="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-sm text-headline-sm font-bold shrink-0">{{ initial() }}</div>
        <div class="min-w-0">
          <p class="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">{{ name() || ('Guest' | translate) }}</p>
          @if (subtitle()) { <p class="font-body-sm text-body-sm text-on-surface-variant truncate">{{ subtitle() | translate }}</p> }
        </div>
      </section>

      <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-level-1 divide-y divide-outline-variant/40">
        <div class="p-space-md flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 text-on-surface-variant"><span class="material-symbols-outlined text-primary">call</span><span class="font-label-md text-label-md">{{ 'Phone' | translate }}</span></div>
          <span class="font-body-md text-body-md text-on-surface font-mono">{{ phone() || '—' }}</span>
        </div>
        <div class="p-space-md flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 text-on-surface-variant"><span class="material-symbols-outlined text-primary">translate</span><span class="font-label-md text-label-md">{{ 'Language' | translate }}</span></div>
          <div class="flex items-center bg-surface-container p-1 rounded-xl border border-outline-variant/40" role="radiogroup" [attr.aria-label]="'Language' | translate">
            <button type="button" role="radio" [attr.aria-checked]="lang.lang() === 'en'" (click)="lang.set('en')" class="px-3.5 py-1 rounded-lg text-label-md font-label-md transition-all" [class]="lang.lang() === 'en' ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant'">English</button>
            <button type="button" role="radio" [attr.aria-checked]="lang.lang() === 'hi'" (click)="lang.set('hi')" class="px-3.5 py-1 rounded-lg text-label-md font-label-md transition-all" [class]="lang.lang() === 'hi' ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant'">हिंदी</button>
          </div>
        </div>
      </section>

      <button type="button" (click)="logout.emit()" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-error/40 text-error font-label-lg text-label-lg font-semibold hover:bg-error-container/40 transition-colors active:scale-[0.98]">
        <span class="material-symbols-outlined text-[20px]">logout</span><span>{{ 'Log out' | translate }}</span>
      </button>
    </main>
  `,
})
export class ProfileView {
  protected readonly lang = inject(LangService);
  readonly name = input('');
  readonly phone = input('');
  readonly subtitle = input('');
  readonly logout = output<void>();
  protected readonly initial = computed(() => initials(this.name()) || '?');
}
