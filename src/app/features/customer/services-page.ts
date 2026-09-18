import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BookingFlowStore } from '../../core/services/booking-flow.store';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { serviceIcon } from '../../core/utils/icons';
import { inr } from '../../core/utils/time';
import { StepBar } from '../../shared/customer/step-bar';

@Component({
  selector: 'app-customer-services',
  imports: [StepBar, TranslatePipe],
  template: `
    <main class="flex-1 w-full max-w-screen-md mx-auto px-space-md py-space-md pb-36">
      <div class="mb-space-md">
        <app-step-bar [step]="1" />
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-2 px-1">{{ 'services.hint' | translate }}</p>
      </div>

      <section class="mb-space-md sticky top-14 bg-background/95 backdrop-blur-md pt-1 pb-2 z-30 -mx-space-md px-space-md border-b border-outline-variant/30">
        <div class="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-1">
          @for (c of ['All'].concat(store.categories()); track c) {
            <button type="button" (click)="filter.set(c)" class="px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-all active:scale-95" [class]="filter() === c ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'bg-surface-container-lowest border border-outline-variant/70 text-on-surface-variant hover:border-primary hover:text-primary'">{{ c }}</button>
          }
        </div>
      </section>

      <section aria-label="Available Services" class="flex flex-col gap-space-md">
        @for (s of visible(); track s.id) {
          <article (click)="flow.toggle(s.id)" class="relative bg-surface-container-lowest rounded-xl p-space-sm transition-all group cursor-pointer" [class]="flow.has(s.id) ? 'border-2 border-primary elevation-2' : 'border border-outline-variant/60 elevation-1 hover:border-outline hover:-translate-y-0.5'">
            <div class="flex items-start gap-space-md p-space-xs">
              <div class="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center transition-colors" [class]="flow.has(s.id) ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant group-hover:text-primary'"><span class="material-symbols-outlined text-[32px]">{{ icon(s.category) }}</span></div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h3 class="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">{{ s.name }}</h3>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full"><span class="material-symbols-outlined text-[13px]">schedule</span> {{ s.duration }}m</span>
                      <span class="font-label-md text-label-md font-bold" [class]="flow.has(s.id) ? 'text-primary' : 'text-on-surface'">{{ inr(s.price) }}</span>
                    </div>
                  </div>
                  <input type="checkbox" class="w-6 h-6 rounded-md text-primary focus:ring-primary focus:ring-offset-0 border-outline-variant cursor-pointer accent-primary" [checked]="flow.has(s.id)" [attr.aria-label]="s.name" (click)="$event.stopPropagation()" (change)="flow.toggle(s.id)" />
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant mt-2 flex items-center gap-1.5 leading-tight"><span class="w-1.5 h-1.5 rounded-full shrink-0" [class]="flow.has(s.id) ? 'bg-primary' : 'bg-outline-variant'"></span> {{ s.description }}</p>
              </div>
            </div>
          </article>
        }
      </section>
    </main>

    <aside class="fixed bottom-0 left-0 w-full z-50 px-space-md py-3 bg-surface-container-lowest/95 backdrop-blur-md elevation-3 border-t border-outline-variant/60 no-print">
      <div class="max-w-screen-md mx-auto flex items-center justify-between gap-space-md">
        <div class="flex flex-col">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{{ flow.serviceIds().length }} {{ 'services.selected' | translate }}</span>
            <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-0.5"><span class="material-symbols-outlined text-[14px]">schedule</span> {{ flow.totalDuration() }} mins</span>
          </div>
          <div class="flex items-baseline gap-1.5 mt-0.5">
            <span class="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">{{ inr(flow.totalPrice()) }}</span>
            <span class="text-[11px] text-outline">incl. GST</span>
          </div>
        </div>
        <button type="button" (click)="next()" class="flex-1 max-w-[240px] bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary py-3 px-space-md rounded-xl font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95" [class.opacity-60]="!flow.serviceIds().length">
          <span>{{ 'services.continue' | translate }}</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </aside>
  `,
})
export class ServicesPage {
  protected readonly store = inject(SalonStore);
  protected readonly flow = inject(BookingFlowStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly inr = inr;
  protected readonly icon = serviceIcon;
  protected readonly filter = signal('All');
  protected readonly visible = computed(() => this.store.selectedServices().filter((s) => this.filter() === 'All' || s.category === this.filter()));

  next() {
    if (!this.flow.serviceIds().length) return this.toast.error('Select at least one service.');
    this.router.navigate(['/s', this.store.profile().slug, 'slot']);
  }
}
