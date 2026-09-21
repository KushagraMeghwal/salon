import { TranslatePipe } from '@ngx-translate/core';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CatalogService } from '../../../core/models';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { WizardHeader } from '../../../shared/layout/wizard-header';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL } from '../../../shared/ui/form-classes';
import { Modal } from '../../../shared/ui/modal';

const CARD_INPUT =
  'w-full pr-3 py-1.5 text-body-md font-body-md bg-surface-container-lowest border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none';
const DEFAULT_CATEGORIES = ['Hair', 'Beard & Shave', 'Waxing', 'Facial & Skin', 'Spa & Massage', 'Nails', 'Coloring'];

@Component({
  selector: 'app-services-step',
  imports: [FormsModule, WizardHeader, Modal, TranslatePipe],
  template: `
    <div class="min-h-screen flex flex-col justify-between bg-background text-on-surface antialiased">
      <app-wizard-header [active]="2" />

      <main class="flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:px-12 flex flex-col gap-8">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-outline-variant/20">
          <div>
            <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-surface-container text-primary text-label-sm font-label-sm mb-2">
              <span class="material-symbols-outlined text-[14px]">checklist</span> {{ "Step 2 of 4" | translate }}
            </div>
            <h1 class="text-headline-lg-mobile md:text-headline-lg font-headline-lg text-on-surface tracking-tight">{{ "Select and configure your services" | translate }}</h1>
            <p class="text-body-md font-body-md text-muted mt-1">{{ "Choose standard services to quick-start or add your own custom packages. Pricing in Indian Rupee (₹)." | translate }}</p>
          </div>
          <div class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm self-start">
            <span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
            <span class="text-label-md font-label-md text-on-surface font-semibold">{{ "{{p1}} services configured" | translate: { p1: (store.selectedServices().length) } }}</span>
            <span class="text-outline-variant">•</span>
            <span class="text-body-sm font-body-sm text-muted">{{ "Average service time:" | translate }} <strong class="text-on-surface font-medium">{{ avgTime() }}m</strong></span>
          </div>
        </div>

        <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          @for (c of ['All'].concat(allCategories()); track c) {
            <button
              type="button"
              (click)="filter.set(c)"
              class="px-4 py-1.5 rounded-full text-label-md font-label-md whitespace-nowrap transition-all duration-150"
              [class]="filter() === c ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant/40 text-on-surface bg-surface-container-lowest hover:bg-surface-container-low'"
            >
              {{ c | translate }}
            </button>
          }
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (s of visible(); track s.id) {
            @if (s.selected) {
              <div class="bg-surface-container-lowest rounded-xl p-5 border-2 border-primary shadow-sm hover:shadow-md transition-all duration-150 flex flex-col justify-between">
                <div>
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <input type="checkbox" checked class="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer" [attr.aria-label]="'Deselect ' + s.name" (change)="store.toggleService(s.id)" />
                      <div>
                        <h3 class="text-headline-sm font-headline-sm text-on-surface">{{ s.name }}</h3>
                        <span class="inline-block mt-0.5 text-label-sm font-label-sm px-2 py-0.5 rounded bg-surface-container text-primary">{{ s.category | translate }}</span>
                      </div>
                    </div>
                    <span class="material-symbols-outlined text-primary text-headline-sm">check_circle</span>
                  </div>
                  <p class="text-body-sm font-body-sm text-muted mt-2">{{ s.description }}</p>
                  <div class="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-outline-variant/20">
                    <div>
                      <label class="block text-label-sm font-label-sm text-muted mb-1" [attr.for]="'price-' + s.id">{{ "Price (₹)" | translate }}</label>
                      <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-muted font-medium text-body-sm">₹</span>
                        <input [id]="'price-' + s.id" type="number" min="0" step="10" [class]="cardInput + ' pl-7'" [ngModel]="s.price" (ngModelChange)="setPrice(s, $event)" />
                      </div>
                    </div>
                    <div>
                      <label class="block text-label-sm font-label-sm text-muted mb-1" [attr.for]="'dur-' + s.id">{{ "Duration" | translate }}</label>
                      <select [id]="'dur-' + s.id" [class]="cardInput + ' pl-3'" [ngModel]="s.duration" (ngModelChange)="store.patchService(s.id, { duration: +$event })">
                        @for (d of durations(s); track d) {
                          <option [ngValue]="d">{{ "{{p1}} mins" | translate: { p1: (d) } }}</option>
                        }
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            } @else {
              <div class="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/30 hover:border-primary/50 transition-all duration-150 flex flex-col justify-between opacity-80 hover:opacity-100">
                <div>
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <input type="checkbox" class="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer" [attr.aria-label]="'Select ' + s.name" (change)="store.toggleService(s.id)" />
                      <div>
                        <h3 class="text-headline-sm font-headline-sm text-on-surface">{{ s.name }}</h3>
                        <span class="inline-block mt-0.5 text-label-sm font-label-sm px-2 py-0.5 rounded bg-surface-container text-muted">{{ s.category | translate }}</span>
                      </div>
                    </div>
                  </div>
                  <p class="text-body-sm font-body-sm text-muted mt-2">{{ s.description }}</p>
                </div>
                <div class="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/20 text-body-sm font-body-sm text-muted">
                  <span>{{ "Suggested:" | translate }} <strong class="text-on-surface font-semibold">₹{{ s.suggestedPrice }}</strong></span>
                  <span class="text-label-sm font-label-sm">{{ "{{p1}} mins" | translate: { p1: (s.suggestedDuration) } }}</span>
                </div>
              </div>
            }
          }

          <button type="button" (click)="openModal()" class="bg-surface-container-lowest/60 border-2 border-dashed border-primary/40 hover:border-primary rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container-low transition-all group">
            <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
              <span class="material-symbols-outlined text-headline-md">add</span>
            </div>
            <h3 class="text-headline-sm font-headline-sm text-primary font-semibold">{{ "+ Add Custom Service" | translate }}</h3>
            <p class="text-body-sm font-body-sm text-muted mt-1 max-w-xs">{{ "Can't find a service? Define unique services, bundles, or specific bridal styling." | translate }}</p>
          </button>
        </div>
      </main>

      <footer class="sticky bottom-0 z-40 bg-surface-container-lowest border-t border-outline-variant/20 shadow-md">
        <div class="max-w-7xl mx-auto px-4 py-4 md:px-12 flex items-center justify-between gap-3">
          <button type="button" (click)="back()" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-label-lg font-label-lg hover:bg-surface-container-low transition-colors duration-150 active:scale-[0.99]">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            <span class="hidden sm:inline">{{ "Back to Salon Details" | translate }}</span><span class="sm:hidden">{{ "Back" | translate }}</span>
          </button>
          <button type="button" (click)="next()" class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary text-label-lg font-label-lg hover:bg-primary-container shadow-sm hover:shadow transition-all duration-150 active:scale-[0.99]">
            <span class="hidden sm:inline">{{ "Continue to Timings & Slots" | translate }}</span><span class="sm:hidden">{{ "Continue" | translate }}</span>
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </footer>

      <app-modal [open]="modal()" [title]="'Add Custom Service' | translate" (closed)="modal.set(false)">
        <form class="space-y-4" (ngSubmit)="saveCustom()" #f="ngForm">
          <div>
            <label [class]="label" for="cs-name">{{ "Custom Service Name" | translate }}</label>
            <input id="cs-name" name="name" [class]="input" [placeholder]="'e.g., Ayurvedic Hair Spa' | translate" [(ngModel)]="draft.name" required />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label [class]="label" for="cs-cat">{{ "Category" | translate }}</label>
              <select id="cs-cat" name="category" [class]="input" [(ngModel)]="draft.category">
                @for (c of allCategories(); track c) {
                  <option [value]="c">{{ c | translate }}</option>
                }
              </select>
            </div>
            <div>
              <label [class]="label" for="cs-price">{{ "Price in ₹" | translate }}</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-muted font-medium text-body-sm">₹</span>
                <input id="cs-price" name="price" type="number" min="0" [class]="input + ' pl-7'" placeholder="500" [(ngModel)]="draft.price" required />
              </div>
            </div>
          </div>
          <div>
            <label [class]="label" for="cs-dur">{{ "Duration in mins" | translate }}</label>
            <input id="cs-dur" name="duration" type="number" min="5" step="5" [class]="input" placeholder="45" [(ngModel)]="draft.duration" required />
          </div>
          <div>
            <label [class]="label" for="cs-desc">{{ "Description" | translate }}</label>
            <textarea id="cs-desc" name="description" rows="3" [class]="input" [placeholder]="'Brief outline of steps, products used, or prerequisites...' | translate" [(ngModel)]="draft.description"></textarea>
          </div>
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20">
            <button type="button" [class]="ghost" (click)="modal.set(false)">{{ "Cancel" | translate }}</button>
            <button type="submit" [class]="primary" [disabled]="f.invalid">{{ "Save Service" | translate }}</button>
          </div>
        </form>
      </app-modal>
    </div>
  `,
})
export class ServicesStep {
  protected readonly store = inject(SalonStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly cardInput = CARD_INPUT;
  protected readonly input = INPUT;
  protected readonly label = LABEL;
  protected readonly primary = BTN_PRIMARY;
  protected readonly ghost = BTN_GHOST;

  protected readonly filter = signal('All');
  protected readonly modal = signal(false);
  protected draft = { name: '', category: 'Hair', price: null as number | null, duration: null as number | null, description: '' };

  protected readonly allCategories = computed(() => [...new Set([...DEFAULT_CATEGORIES, ...this.store.services().map((s) => s.category)])]);
  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.store.services().filter((s) => f === 'All' || s.category === f);
  });
  protected readonly avgTime = computed(() => {
    const l = this.store.selectedServices();
    return l.length ? Math.round(l.reduce((a, s) => a + s.duration, 0) / l.length) : 0;
  });

  durations(s: CatalogService) {
    return [...new Set([...s.durationOptions, s.duration])].sort((a, b) => a - b);
  }

  setPrice(s: CatalogService, v: number | string) {
    this.store.patchService(s.id, { price: Math.max(0, Number(v) || 0) });
  }

  openModal() {
    this.draft = { name: '', category: this.allCategories()[0], price: null, duration: null, description: '' };
    this.modal.set(true);
  }

  saveCustom() {
    const d = this.draft;
    this.store.addCustomService(d.name.trim(), d.category, Number(d.price), Number(d.duration), d.description.trim());
    this.toast.success('"{{p1}}" added', { p1: d.name.trim() });
    this.modal.set(false);
  }

  back() {
    this.router.navigateByUrl('/owner/onboarding/salon');
  }

  next() {
    if (!this.store.selectedServices().length) return this.toast.error('Select at least one service to continue.');
    this.router.navigateByUrl('/owner/onboarding/timings');
  }
}
