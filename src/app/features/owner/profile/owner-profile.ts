import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogService, SalonProfile } from '../../../core/models';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { AuthService } from '../../../core/services/auth.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { EMAIL_OK, INDIAN_STATES, PHONE_OK, PIN_OK } from '../../../core/utils/india';
import { inr, initials } from '../../../core/utils/time';
import { Topbar } from '../../../shared/layout/topbar';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL } from '../../../shared/ui/form-classes';
import { Modal } from '../../../shared/ui/modal';
import { Toggle } from '../../../shared/ui/toggle';

type Tab = 'profile' | 'services';
interface Draft { owner: string; salon: SalonProfile }
interface ServiceForm { id: string | null; name: string; category: string; newCategory: string; price: number | null; duration: number | null; description: string }

const CATEGORIES: SalonProfile['category'][] = ['Unisex', "Men's Salon", 'Hair Studio', 'Luxury Spa'];
const SERVICE_CATEGORIES = ['Hair', 'Beard & Shave', 'Waxing', 'Facial & Skin', 'Spa & Massage', 'Nails', 'Coloring'];
const NEW_CATEGORY = '__new__';
const CARD = 'bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 md:p-6 nordic-shadow';

@Component({
  selector: 'app-owner-profile',
  imports: [FormsModule, RouterLink, Topbar, Modal, Toggle, TranslatePipe],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-2 min-w-0"><span class="material-symbols-outlined text-primary">manage_accounts</span><span class="font-headline-sm text-headline-sm text-on-surface truncate">{{ 'Edit profile' | translate }}</span></div>
    </app-topbar>

    <main class="lg:pl-64 pt-16 min-h-screen bg-background">
      <div class="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6" [class.pb-28]="dirty()">
        <!-- Identity header -->
        <section [class]="card + ' flex flex-col sm:flex-row sm:items-center gap-4'">
          <div class="relative shrink-0 self-start">
            @if (draft().salon.logo; as logo) {
              <img [src]="logo" [alt]="draft().salon.name" class="w-20 h-20 rounded-2xl object-contain bg-white border border-outline-variant/40" />
            } @else {
              <div class="w-20 h-20 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center font-headline-md text-headline-md font-bold">{{ initials(draft().salon.name) || '?' }}</div>
            }
            <label class="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-primary text-on-primary shadow-md flex items-center justify-center cursor-pointer hover:bg-primary-container transition-colors" [title]="'Change logo' | translate">
              <span class="material-symbols-outlined text-[18px]">{{ uploading() ? 'progress_activity' : 'photo_camera' }}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" [disabled]="uploading()" (change)="onLogo($any($event.target))" [attr.aria-label]="'Change logo' | translate" />
            </label>
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight truncate">{{ draft().salon.name || ('Your salon' | translate) }}</h1>
            <p class="font-body-md text-body-md text-on-surface-variant">{{ draft().salon.category | translate }}@if (draft().salon.city) { · {{ draft().salon.city }} }</p>
            <p class="font-body-sm text-body-sm text-outline mt-1 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">person</span>{{ draft().owner || auth.profile().name }} · {{ auth.profile().email || ('Salon Owner' | translate) }}</p>
          </div>
          @if (store.profile().slug) {
            <a [routerLink]="['/s', store.profile().slug]" target="_blank" class="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low font-label-md text-label-md text-on-surface transition-colors"><span class="material-symbols-outlined text-[18px]">open_in_new</span>{{ 'View booking page' | translate }}</a>
          }
        </section>

        <!-- Tabs -->
        <div class="flex gap-2 border-b border-outline-variant/30" role="tablist">
          @for (t of tabs; track t.key) {
            <button type="button" role="tab" [attr.aria-selected]="tab() === t.key" (click)="setTab(t.key)" class="px-4 py-2.5 -mb-px border-b-2 flex items-center gap-2 font-label-lg text-label-lg transition-colors" [class]="tab() === t.key ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface'">
              <span class="material-symbols-outlined text-[20px]">{{ t.icon }}</span>{{ t.label | translate }}
              @if (t.key === 'services') { <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">{{ store.selectedServices().length }}</span> }
            </button>
          }
        </div>

        @if (tab() === 'profile') {
          <form class="space-y-6" (ngSubmit)="save()" autocomplete="on">
            <section [class]="card">
              <div class="flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-primary">badge</span><h2 class="font-headline-sm text-headline-sm text-on-surface">{{ 'Your account' | translate }}</h2></div>
              <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">{{ 'Your name as shown in the Chairly sidebar.' | translate }}</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label [class]="label" for="pf-owner">{{ 'Your name' | translate }}</label>
                  <input id="pf-owner" name="owner" autocomplete="name" maxlength="60" [class]="input" [class.border-error]="touched() && !ownerOk()" [ngModel]="draft().owner" (ngModelChange)="patchOwner($event)" />
                  @if (touched() && !ownerOk()) { <p class="text-body-sm text-error mt-1">{{ 'Enter at least 2 characters.' | translate }}</p> }
                </div>
                <div>
                  <label [class]="label" for="pf-login">{{ 'Login email' | translate }}</label>
                  <input id="pf-login" name="login" [class]="input + ' bg-surface-container-low! text-on-surface-variant'" [value]="auth.profile().email || '—'" readonly />
                  <p class="text-body-sm text-outline mt-1">{{ 'Used to sign in. Contact support to change it.' | translate }}</p>
                </div>
              </div>
            </section>

            <section [class]="card">
              <div class="flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-primary">storefront</span><h2 class="font-headline-sm text-headline-sm text-on-surface">{{ 'Salon details' | translate }}</h2></div>
              <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">{{ 'Customers see these on your booking page. Your booking link stays the same.' | translate }}</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                  <label [class]="label" for="pf-name">{{ 'Salon name' | translate }}</label>
                  <input id="pf-name" name="salonName" autocomplete="organization" maxlength="80" [class]="input" [class.border-error]="touched() && !nameOk()" [ngModel]="draft().salon.name" (ngModelChange)="patch({ name: $event })" />
                  @if (touched() && !nameOk()) { <p class="text-body-sm text-error mt-1">{{ 'Enter at least 2 characters.' | translate }}</p> }
                </div>
                <div class="md:col-span-2">
                  <span [class]="label">{{ 'Salon type' | translate }}</span>
                  <div class="flex flex-wrap gap-2">
                    @for (c of categories; track c) {
                      <button type="button" (click)="patch({ category: c })" class="px-4 py-2 rounded-xl border font-label-md text-label-md transition-colors" [class]="draft().salon.category === c ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/60 text-on-surface hover:bg-surface-container-low'">{{ c | translate }}</button>
                    }
                  </div>
                </div>
                <div>
                  <label [class]="label" for="pf-phone">{{ 'Salon phone' | translate }}</label>
                  <div class="relative"><span class="absolute inset-y-0 left-0 pl-3 flex items-center text-outline text-body-md">+91</span>
                    <input id="pf-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" [class]="input + ' pl-12'" [class.border-error]="touched() && !phoneOk()" [ngModel]="draft().salon.phone" (ngModelChange)="patch({ phone: digits($event) })" />
                  </div>
                  @if (touched() && !phoneOk()) { <p class="text-body-sm text-error mt-1">{{ 'Enter a valid 10-digit mobile number.' | translate }}</p> }
                </div>
                <div>
                  <label [class]="label" for="pf-email">{{ 'Salon email' | translate }}</label>
                  <input id="pf-email" name="email" type="email" autocomplete="email" [class]="input" [class.border-error]="touched() && !emailOk()" [ngModel]="draft().salon.email" (ngModelChange)="patch({ email: $event.trim() })" />
                  @if (touched() && !emailOk()) { <p class="text-body-sm text-error mt-1">{{ 'Enter a valid email address.' | translate }}</p> }
                </div>
              </div>
            </section>

            <section [class]="card">
              <div class="flex items-center gap-2 mb-4"><span class="material-symbols-outlined text-primary">location_on</span><h2 class="font-headline-sm text-headline-sm text-on-surface">{{ 'Address' | translate }}</h2></div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2"><label [class]="label" for="pf-street">{{ 'Shop no. & street' | translate }}</label><input id="pf-street" name="street" autocomplete="address-line1" maxlength="120" [class]="input" [ngModel]="draft().salon.street" (ngModelChange)="patch({ street: $event })" /></div>
                <div class="md:col-span-2"><label [class]="label" for="pf-landmark">{{ 'Landmark / area' | translate }}</label><input id="pf-landmark" name="landmark" autocomplete="address-line2" maxlength="120" [class]="input" [ngModel]="draft().salon.landmark" (ngModelChange)="patch({ landmark: $event })" /></div>
                <div><label [class]="label" for="pf-city">{{ 'City' | translate }}</label><input id="pf-city" name="city" autocomplete="address-level2" maxlength="60" [class]="input" [ngModel]="draft().salon.city" (ngModelChange)="patch({ city: $event })" /></div>
                <div>
                  <label [class]="label" for="pf-pin">{{ 'PIN code' | translate }}</label>
                  <input id="pf-pin" name="pin" inputmode="numeric" autocomplete="postal-code" maxlength="6" [class]="input" [class.border-error]="touched() && !pinOk()" [ngModel]="draft().salon.pin" (ngModelChange)="patch({ pin: digits($event).slice(0, 6) })" />
                  @if (touched() && !pinOk()) { <p class="text-body-sm text-error mt-1">{{ 'Enter a valid 6-digit PIN code.' | translate }}</p> }
                </div>
                <div class="md:col-span-2">
                  <label [class]="label" for="pf-state">{{ 'State / Union Territory' | translate }}</label>
                  <select id="pf-state" name="state" autocomplete="address-level1" [class]="input" [ngModel]="draft().salon.state" (ngModelChange)="patch({ state: $event })">
                    <option value="">{{ 'Select state' | translate }}</option>
                    @for (s of states; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }
                  </select>
                </div>
              </div>
            </section>
            <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
          </form>
        }

        @if (tab() === 'services') {
          <section class="grid grid-cols-3 gap-3">
            <div [class]="card + ' p-4!'"><p class="font-label-sm text-label-sm text-outline">{{ 'Live services' | translate }}</p><p class="text-headline-md font-headline-md text-on-surface mt-1">{{ store.selectedServices().length }}<span class="text-body-sm text-outline"> / {{ store.services().length }}</span></p></div>
            <div [class]="card + ' p-4!'"><p class="font-label-sm text-label-sm text-outline">{{ 'Price range' | translate }}</p><p class="text-headline-sm font-headline-sm text-on-surface mt-1 truncate">{{ priceRange() }}</p></div>
            <div [class]="card + ' p-4!'"><p class="font-label-sm text-label-sm text-outline">{{ 'Avg. duration' | translate }}</p><p class="text-headline-md font-headline-md text-on-surface mt-1">{{ avgDuration() }}<span class="text-body-sm text-outline"> {{ 'min' | translate }}</span></p></div>
          </section>

          <div class="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div class="relative flex-1 max-w-md">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline">search</span>
              <input type="search" [class]="input + ' pl-10 h-11'" [placeholder]="'Search services' | translate" [attr.aria-label]="'Search services' | translate" [ngModel]="query()" (ngModelChange)="query.set($event)" />
            </div>
            <button type="button" (click)="openService(null)" class="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all"><span class="material-symbols-outlined text-[20px]">add</span>{{ 'Add service' | translate }}</button>
          </div>

          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            @for (c of filterChips(); track c) {
              <button type="button" (click)="catFilter.set(c)" class="px-3.5 py-1.5 rounded-full whitespace-nowrap font-label-md text-label-md transition-colors" [class]="catFilter() === c ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest border border-outline-variant/50 text-on-surface hover:bg-surface-container-low'">{{ c | translate }}</button>
            }
          </div>

          @for (g of groups(); track g.category) {
            <section class="space-y-2">
              <h3 class="font-label-md text-label-md text-outline uppercase tracking-wider px-1">{{ g.category | translate }} · {{ g.items.length }}</h3>
              <div class="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl divide-y divide-outline-variant/30 overflow-hidden">
                @for (s of g.items; track s.id) {
                  <div class="p-4 flex items-start gap-3 sm:gap-4 transition-colors" [class.opacity-60]="!s.selected">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <p class="font-label-lg text-label-lg text-on-surface font-semibold">{{ s.name }}</p>
                        @if (!s.selected) { <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant uppercase">{{ 'Hidden' | translate }}</span> }
                      </div>
                      @if (s.description) { <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-0.5">{{ s.description }}</p> }
                      <div class="flex items-center gap-3 mt-2 font-label-md text-label-md">
                        <span class="text-on-surface font-semibold">{{ inr(s.price) }}</span>
                        <span class="text-outline flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">schedule</span>{{ '{{p1}} mins' | translate: { p1: s.duration } }}</span>
                      </div>
                    </div>
                    <div class="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                      <app-toggle [checked]="s.selected" [disabled]="s.selected && store.selectedServices().length === 1" (checkedChange)="toggle(s)" [label]="'Show on booking page' | translate" [attr.title]="s.selected && store.selectedServices().length === 1 ? ('Keep at least one service live so customers can book.' | translate) : null" />
                      <button type="button" (click)="openService(s)" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant/60 text-on-surface hover:bg-surface-container-low font-label-md text-label-md transition-colors"><span class="material-symbols-outlined text-[16px]">edit</span>{{ 'Edit' | translate }}</button>
                    </div>
                  </div>
                }
              </div>
            </section>
          } @empty {
            <div [class]="card + ' text-center py-10'">
              <span class="material-symbols-outlined text-[40px] text-outline">content_cut</span>
              <p class="font-body-md text-body-md text-on-surface-variant mt-2">{{ query() || catFilter() !== 'All' ? ('No services match your search.' | translate) : ('No services yet. Add your first service.' | translate) }}</p>
            </div>
          }
        }
      </div>
    </main>

    <!-- Sticky save bar for the profile draft -->
    @if (tab() === 'profile' && dirty()) {
      <div class="fixed bottom-0 right-0 left-0 lg:left-64 z-30 bg-surface-container-lowest/95 backdrop-blur border-t border-outline-variant/40 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]">
        <div class="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <span class="hidden sm:flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant"><span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>{{ 'You have unsaved changes' | translate }}</span>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button type="button" (click)="discard()" [disabled]="saving()" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface font-label-lg text-label-lg hover:bg-surface-container-low disabled:opacity-50">{{ 'Discard' | translate }}</button>
            <button type="button" (click)="save()" [disabled]="saving() || uploading()" class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold shadow-sm hover:bg-primary-container disabled:opacity-60">
              <span class="material-symbols-outlined text-[18px]" [class.animate-spin]="saving()">{{ saving() ? 'progress_activity' : 'check' }}</span>{{ 'Save changes' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <app-modal [open]="form() !== null" [title]="(form()?.id ? 'Edit service' : 'Add service') | translate" (closed)="form.set(null)">
      @if (form(); as f) {
        <form class="space-y-4" (ngSubmit)="saveService()" #sf="ngForm">
          <div>
            <label [class]="label" for="sv-name">{{ 'Service name' | translate }}</label>
            <input id="sv-name" name="name" [class]="input" maxlength="100" required minlength="2" [(ngModel)]="f.name" [placeholder]="'e.g., Ayurvedic Hair Spa' | translate" />
          </div>
          <div>
            <label [class]="label" for="sv-cat">{{ 'Category' | translate }}</label>
            <select id="sv-cat" name="category" [class]="input" [(ngModel)]="f.category">
              @for (c of allCategories(); track c) { <option [value]="c">{{ c | translate }}</option> }
              <option [value]="newCategory">{{ '+ New category' | translate }}</option>
            </select>
            @if (f.category === newCategory) {
              <input name="newCategory" [class]="input + ' mt-2'" maxlength="60" required [(ngModel)]="f.newCategory" [placeholder]="'Category name' | translate" [attr.aria-label]="'Category name' | translate" />
            }
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label [class]="label" for="sv-price">{{ 'Price (₹)' | translate }}</label>
              <div class="relative"><span class="absolute inset-y-0 left-0 pl-3 flex items-center text-outline">₹</span>
                <input id="sv-price" name="price" type="number" inputmode="numeric" min="0" max="100000" step="10" required [class]="input + ' pl-7'" [(ngModel)]="f.price" />
              </div>
            </div>
            <div>
              <label [class]="label" for="sv-dur">{{ 'Duration (mins)' | translate }}</label>
              <input id="sv-dur" name="duration" type="number" inputmode="numeric" min="5" max="480" step="5" required [class]="input" [(ngModel)]="f.duration" list="sv-durations" />
              <datalist id="sv-durations">@for (d of durationPresets; track d) { <option [value]="d"></option> }</datalist>
            </div>
          </div>
          <div>
            <label [class]="label" for="sv-desc">{{ 'Description' | translate }} <span class="text-outline font-normal">({{ 'optional' | translate }})</span></label>
            <textarea id="sv-desc" name="description" rows="3" maxlength="300" [class]="input" [(ngModel)]="f.description" [placeholder]="'What is included, products used, who it is for...' | translate"></textarea>
            <p class="text-right text-[11px] text-outline mt-0.5">{{ f.description.length }}/300</p>
          </div>
          @if (f.id && priceChanged(f)) {
            <p class="flex items-start gap-2 p-3 rounded-xl bg-secondary-fixed/40 text-on-secondary-fixed-variant font-body-sm text-body-sm"><span class="material-symbols-outlined text-[18px]">info</span>{{ 'New price applies to new bookings. Existing bookings keep their price.' | translate }}</p>
          }
          @if (formError()) { <p class="text-body-sm text-error">{{ formError() | translate }}</p> }
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20">
            <button type="button" [class]="ghost" (click)="form.set(null)">{{ 'Cancel' | translate }}</button>
            <button type="submit" [class]="primary" [disabled]="sf.invalid">{{ (f.id ? 'Save changes' : 'Add service') | translate }}</button>
          </div>
        </form>
      }
    </app-modal>
  `,
})
export class OwnerProfile implements HasUnsavedChanges {
  protected readonly store = inject(SalonStore);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly route = inject(ActivatedRoute);

  protected readonly card = CARD;
  protected readonly input = INPUT;
  protected readonly label = LABEL;
  protected readonly primary = BTN_PRIMARY;
  protected readonly ghost = BTN_GHOST;
  protected readonly categories = CATEGORIES;
  protected readonly states = INDIAN_STATES;
  protected readonly newCategory = NEW_CATEGORY;
  protected readonly durationPresets = [15, 30, 45, 60, 75, 90, 120, 150, 180];
  protected readonly inr = inr;
  protected readonly initials = initials;
  protected readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'profile', label: 'Profile', icon: 'person' },
    { key: 'services', label: 'Services & prices', icon: 'content_cut' },
  ];

  // Deep links: /owner/profile;tab=services (setup-health) or ?tab=services.
  protected readonly tab = signal<Tab>((this.route.snapshot.paramMap.get('tab') ?? this.route.snapshot.queryParamMap.get('tab')) === 'services' ? 'services' : 'profile');
  protected readonly draft = signal<Draft>(this.snapshot());
  protected readonly touched = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);

  protected readonly query = signal('');
  protected readonly catFilter = signal('All');
  protected readonly form = signal<ServiceForm | null>(null);
  protected readonly formError = signal('');

  protected readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.snapshot()));
  protected readonly ownerOk = computed(() => this.draft().owner.trim().length >= 2);
  protected readonly nameOk = computed(() => this.draft().salon.name.trim().length >= 2);
  protected readonly phoneOk = computed(() => PHONE_OK(this.draft().salon.phone));
  protected readonly emailOk = computed(() => EMAIL_OK(this.draft().salon.email));
  protected readonly pinOk = computed(() => PIN_OK(this.draft().salon.pin));
  private readonly valid = computed(() => this.ownerOk() && this.nameOk() && this.phoneOk() && this.emailOk() && this.pinOk());

  protected readonly allCategories = computed(() => [...new Set([...SERVICE_CATEGORIES, ...this.store.services().map((s) => s.category)])]);
  protected readonly filterChips = computed(() => ['All', 'Live', 'Hidden', ...new Set(this.store.services().map((s) => s.category))]);
  protected readonly groups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.catFilter();
    const list = this.store.services().filter(
      (s) =>
        (f === 'All' || (f === 'Live' && s.selected) || (f === 'Hidden' && !s.selected) || s.category === f) &&
        (!q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)),
    );
    const map = new Map<string, CatalogService[]>();
    // Live services first inside each category, then by name.
    for (const s of [...list].sort((a, b) => Number(b.selected) - Number(a.selected) || a.name.localeCompare(b.name))) {
      map.set(s.category, [...(map.get(s.category) ?? []), s]);
    }
    return [...map].map(([category, items]) => ({ category, items }));
  });
  protected readonly priceRange = computed(() => {
    const p = this.store.selectedServices().map((s) => s.price);
    if (!p.length) return '—';
    const lo = Math.min(...p);
    const hi = Math.max(...p);
    return lo === hi ? inr(lo) : `${inr(lo)} – ${inr(hi)}`;
  });
  protected readonly avgDuration = computed(() => {
    const l = this.store.selectedServices();
    return l.length ? Math.round(l.reduce((a, s) => a + s.duration, 0) / l.length) : 0;
  });

  private snapshot(): Draft {
    return { owner: this.auth.profile().name, salon: { ...this.store.profile() } };
  }

  hasUnsavedChanges() {
    return this.dirty();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(e: BeforeUnloadEvent) {
    if (this.dirty()) e.preventDefault();
  }

  protected setTab(t: Tab) {
    this.tab.set(t);
  }

  // ---------- profile draft ----------
  protected digits(v: string) {
    return (v ?? '').replace(/\D/g, '');
  }
  protected patch(p: Partial<SalonProfile>) {
    this.draft.update((d) => ({ ...d, salon: { ...d.salon, ...p } }));
  }
  protected patchOwner(v: string) {
    this.draft.update((d) => ({ ...d, owner: v }));
  }

  protected onLogo(el: HTMLInputElement) {
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return this.toast.error('Logo must be a PNG, JPG or WebP image.');
    if (file.size > 5 * 1024 * 1024) return this.toast.error('Logo must be 5MB or smaller.');
    this.uploading.set(true);
    this.cloudinary
      .uploadImage(file)
      .then((url) => {
        this.patch({ logo: url });
        this.toast.info('Logo uploaded. Save changes to publish it.');
      })
      .catch(() => this.toast.error('Could not upload the logo. Please try again.'))
      .finally(() => this.uploading.set(false));
  }

  protected async save() {
    this.touched.set(true);
    if (!this.valid()) return this.toast.error('Please fix the highlighted fields.');
    if (this.saving()) return;
    this.saving.set(true);
    const d = this.draft();
    try {
      if (d.owner.trim() !== this.auth.profile().name) await this.auth.updateDisplayName(d.owner);
      this.store.patchProfile({ ...d.salon, name: d.salon.name.trim(), email: d.salon.email.trim() });
      await this.store.flush();
      this.draft.set(this.snapshot());
      this.touched.set(false);
      this.toast.success('Profile updated');
    } catch {
      this.toast.error('Could not save your changes. Check your connection.');
    } finally {
      this.saving.set(false);
    }
  }

  protected discard() {
    this.draft.set(this.snapshot());
    this.touched.set(false);
  }

  // ---------- services ----------
  protected toggle(s: CatalogService) {
    if (s.selected && this.store.selectedServices().length === 1) return this.toast.error('Keep at least one service live so customers can book.');
    this.store.toggleService(s.id);
    this.toast.info(s.selected ? '"{{p1}}" hidden from your booking page' : '"{{p1}}" is live on your booking page', { p1: s.name });
  }

  protected openService(s: CatalogService | null) {
    this.formError.set('');
    this.form.set(
      s
        ? { id: s.id, name: s.name, category: s.category, newCategory: '', price: s.price, duration: s.duration, description: s.description === 'Custom service' ? '' : s.description }
        : { id: null, name: '', category: this.catFilter() !== 'All' && this.allCategories().includes(this.catFilter()) ? this.catFilter() : this.allCategories()[0], newCategory: '', price: null, duration: 30, description: '' },
    );
  }

  protected priceChanged(f: ServiceForm) {
    return f.id !== null && this.store.serviceById(f.id)?.price !== Number(f.price);
  }

  protected saveService() {
    const f = this.form();
    if (!f) return;
    const name = f.name.trim().replace(/\s+/g, ' ');
    const category = (f.category === NEW_CATEGORY ? f.newCategory : f.category).trim();
    const price = Math.round(Number(f.price));
    const duration = Math.round(Number(f.duration));
    if (name.length < 2) return this.formError.set('Enter a service name.');
    if (!category) return this.formError.set('Choose or enter a category.');
    if (!Number.isFinite(price) || price < 0 || price > 100000) return this.formError.set('Price must be between ₹0 and ₹1,00,000.');
    if (!Number.isFinite(duration) || duration < 5 || duration > 480) return this.formError.set('Duration must be between 5 and 480 minutes.');
    const dupe = this.store.services().some((s) => s.id !== f.id && s.name.trim().toLowerCase() === name.toLowerCase());
    if (dupe) return this.formError.set('A service with this name already exists.');

    const description = f.description.trim();
    if (f.id) {
      const cur = this.store.serviceById(f.id);
      this.store.patchService(f.id, {
        name, category, price, duration, description,
        durationOptions: [...new Set([...(cur?.durationOptions ?? []), duration])].sort((a, b) => a - b),
      });
      this.toast.success('"{{p1}}" updated', { p1: name });
    } else {
      this.store.addCustomService(name, category, price, duration, description);
      this.toast.success('"{{p1}}" added', { p1: name });
    }
    this.form.set(null);
  }
}
