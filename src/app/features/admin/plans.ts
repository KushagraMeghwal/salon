import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Plan } from '../../core/models';
import { AdminStore } from '../../core/services/admin.store';
import { ToastService } from '../../core/services/toast.service';
import { inr } from '../../core/utils/time';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL } from '../../shared/ui/form-classes';
import { Modal } from '../../shared/ui/modal';

@Component({
  selector: 'app-admin-plans',
  imports: [FormsModule, Modal],
  template: `
    <div class="p-4 md:p-8 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <div><h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Plans</h1><p class="font-body-md text-body-md text-outline">Subscription tiers offered to salons after the 14-day free trial.</p></div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        @for (p of store.planCounts(); track p.plan.id) {
          <div class="bg-surface-container-lowest rounded-2xl p-6 shadow-level-1 flex flex-col gap-4 relative" [class]="p.plan.highlight ? 'border-2 border-primary' : 'border border-outline-variant/30'">
            @if (p.plan.highlight) { <span class="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm uppercase tracking-wider">Most popular</span> }
            <div><h2 class="font-headline-md text-headline-md text-on-surface">{{ p.plan.name }}</h2><p class="font-body-sm text-body-sm text-tertiary">{{ p.plan.tagline }}</p></div>
            <div class="flex items-baseline gap-1"><span class="font-headline-xl text-headline-xl-mobile md:text-headline-xl text-primary">{{ inr(p.plan.price) }}</span><span class="text-body-sm text-tertiary">/ month</span></div>
            <ul class="flex flex-col gap-2 flex-1">
              @for (f of p.plan.features; track f) { <li class="flex items-start gap-2 text-body-md text-on-surface"><span class="material-symbols-outlined text-primary text-[18px] mt-0.5" style="font-variation-settings: 'FILL' 1;">check_circle</span><span>{{ f }}</span></li> }
            </ul>
            <div class="pt-4 border-t border-outline-variant/20 flex items-center justify-between gap-2">
              <span class="font-label-md text-label-md text-tertiary"><strong class="text-on-surface">{{ p.count }}</strong> subscriber{{ p.count === 1 ? '' : 's' }}</span>
              <button type="button" (click)="edit(p.plan)" class="px-3.5 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/5 font-label-md text-label-md transition-colors">Edit price</button>
            </div>
          </div>
        }
      </div>

      <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
        <span class="material-symbols-outlined text-primary text-[20px] mt-0.5">info</span>
        <p class="text-body-sm text-tertiary">Price changes apply to new subscriptions and the next renewal. Payments go directly to each salon's own payment account; these plan fees are billed by Chairly.</p>
      </div>
    </div>

    <app-modal [open]="editing() !== null" title="Edit plan price" (closed)="editing.set(null)">
      @if (editing(); as p) {
        <form class="space-y-4" (ngSubmit)="save()" #f="ngForm">
          <p class="text-body-md text-tertiary">Monthly price for the <strong class="text-on-surface">{{ p.name }}</strong> plan.</p>
          <div><label [class]="label" for="pl-price">Price in ₹ / month</label><div class="relative"><span class="absolute inset-y-0 left-0 pl-3 flex items-center text-tertiary font-medium text-body-sm">₹</span><input id="pl-price" name="price" type="number" min="0" step="50" [class]="input + ' pl-7'" [(ngModel)]="price" required /></div></div>
          <div class="flex justify-end gap-3 pt-4 border-t border-outline-variant/20"><button type="button" [class]="ghost" (click)="editing.set(null)">Cancel</button><button type="submit" [class]="primary" [disabled]="f.invalid">Save price</button></div>
        </form>
      }
    </app-modal>
  `,
})
export class AdminPlans {
  protected readonly store = inject(AdminStore);
  private readonly toast = inject(ToastService);
  protected readonly inr = inr;
  protected readonly input = INPUT;
  protected readonly label = LABEL;
  protected readonly primary = BTN_PRIMARY;
  protected readonly ghost = BTN_GHOST;
  protected readonly editing = signal<Plan | null>(null);
  protected price: number | null = null;

  edit(p: Plan) {
    this.price = p.price;
    this.editing.set(p);
  }

  save() {
    const p = this.editing();
    if (!p || this.price == null || this.price < 0) return;
    this.store.setPrice(p.id, Math.round(this.price));
    this.toast.success(`${p.name} is now ${inr(this.price)} / month`);
    this.editing.set(null);
  }
}
