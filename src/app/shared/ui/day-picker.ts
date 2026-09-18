import { Component, model } from '@angular/core';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

@Component({
  selector: 'app-day-picker',
  template: `
    <div class="flex items-center justify-between gap-1.5">
      @for (d of days(); track $index) {
        <button
          type="button"
          [attr.aria-label]="names[$index]"
          [attr.aria-pressed]="d"
          (click)="toggle($index)"
          class="w-9 h-9 rounded-lg text-label-md font-label-md transition-colors"
          [class]="
            d
              ? 'bg-primary text-on-primary font-semibold shadow-level-1'
              : 'bg-surface-container text-muted border border-outline-variant/30 hover:border-primary'
          "
        >
          {{ letters[$index] }}
        </button>
      }
    </div>
  `,
})
export class DayPicker {
  readonly days = model<boolean[]>([true, true, true, true, true, false, false]);
  protected readonly letters = LETTERS;
  protected readonly names = NAMES;

  toggle(i: number) {
    this.days.update((d) => d.map((v, idx) => (idx === i ? !v : v)));
  }
}
