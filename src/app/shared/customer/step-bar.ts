import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-step-bar',
  imports: [TranslatePipe],
  template: `
    <section class="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-space-md elevation-1">
      <div class="flex items-center justify-between mb-space-xs gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm tracking-wider uppercase whitespace-nowrap">{{ 'step.of' | translate: { n: step(), total: 4 } }}</span>
          <h1 class="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">{{ labelKey() | translate }}</h1>
        </div>
        <span class="font-label-sm text-label-sm text-primary font-bold whitespace-nowrap">{{ percent() }}%</span>
      </div>
      <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden mt-2">
        <div class="bg-primary h-full rounded-full transition-all duration-500 ease-out" [style.width.%]="percent()"></div>
      </div>
      <ng-content />
    </section>
  `,
})
export class StepBar {
  readonly step = input.required<number>();
  protected readonly percent = computed(() => this.step() * 25);
  protected readonly labelKey = computed(() => ['step.services', 'step.slot', 'step.stylist', 'step.pay'][this.step() - 1]);
}
