import { Component, computed, input } from '@angular/core';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-donut-chart',
  template: `
    <div class="relative flex items-center justify-center py-2">
      <svg class="w-48 h-48 transform -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" fill="transparent" r="62" stroke="#e4f0f5" stroke-width="18"></circle>
        @for (a of arcs(); track a.label) {
          <circle cx="80" cy="80" fill="transparent" r="62" [attr.stroke]="a.color" [attr.stroke-dasharray]="a.len + ' ' + C" [attr.stroke-dashoffset]="a.offset" stroke-width="18"></circle>
        }
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <ng-content />
      </div>
    </div>
  `,
})
export class DonutChart {
  readonly segments = input.required<DonutSegment[]>();
  protected readonly C = 2 * Math.PI * 62;

  protected readonly arcs = computed(() => {
    const total = this.segments().reduce((a, s) => a + s.value, 0) || 1;
    let acc = 0;
    return this.segments().map((s) => {
      const len = (s.value / total) * this.C;
      const arc = { label: s.label, color: s.color, len, offset: -acc };
      acc += len;
      return arc;
    });
  });
}
