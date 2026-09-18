import { Component, input, model } from '@angular/core';

@Component({
  selector: 'app-toggle',
  template: `
    <label class="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" class="sr-only peer" [checked]="checked()" [attr.aria-label]="label()" (change)="checked.set($any($event.target).checked)" />
      <div
        class="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"
      ></div>
    </label>
  `,
})
export class Toggle {
  readonly checked = model(false);
  readonly label = input('Toggle');
}
