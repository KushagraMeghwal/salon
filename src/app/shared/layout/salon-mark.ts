import { Component, computed, inject, input } from '@angular/core';
import { SalonStore } from '../../core/services/salon.store';
import { initials } from '../../core/utils/time';

/** The salon's own logo (or monogram fallback). Chairly's logo is only used on splash. */
@Component({
  selector: 'app-salon-mark',
  template: `
    @if (store.profile().logo; as logo) {
      <img [src]="logo" [alt]="store.profile().name + ' logo'" class="object-contain bg-white border border-outline-variant/20" [class]="sizeClass()" />
    } @else {
      <div class="bg-linear-to-br from-primary to-primary-container text-on-primary flex items-center justify-center font-headline-md font-bold shrink-0" [class]="sizeClass()">
        {{ mono() }}
      </div>
    }
  `,
})
export class SalonMark {
  protected readonly store = inject(SalonStore);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  protected readonly mono = computed(() => initials(this.store.profile().name));
  protected readonly sizeClass = computed(() =>
    ({ sm: 'w-8 h-8 rounded-lg text-label-md', md: 'w-10 h-10 rounded-xl text-label-lg', lg: 'w-16 h-16 rounded-xl text-headline-md ring-4 ring-primary-fixed/30 shadow-md' })[this.size()],
  );
}
