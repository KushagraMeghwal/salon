import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BookingFlowStore } from '../../core/services/booking-flow.store';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { serviceIcon } from '../../core/utils/icons';
import { tr } from '../../core/utils/i18n';
import { dateKey, fmt12Str, inr } from '../../core/utils/time';

@Component({
  selector: 'app-customer-home',
  imports: [RouterLink, TranslatePipe],
  template: `
    @if (!found()) {
      <main class="flex-1 flex flex-col items-center justify-center text-center px-space-md py-space-2xl gap-3">
        <span class="material-symbols-outlined text-5xl text-primary/40">storefront</span>
        <h1 class="text-headline-md font-headline-md text-on-surface">{{ "Salon not found" | translate }}</h1>
        <p class="text-body-md text-on-surface-variant max-w-xs">{{ "This booking link isn't active. Please check the link with your salon." | translate }}</p>
      </main>
    } @else {
      <main class="max-w-screen-md w-full mx-auto px-space-md pt-space-md space-y-space-lg flex-1">
        <section class="relative rounded-2xl overflow-hidden elevation-1 bg-surface-container-lowest border border-outline-variant">
          <div class="relative h-56 sm:h-72 w-full overflow-hidden bg-surface-container">
            <div class="w-full h-full bg-linear-to-br from-primary via-primary-container to-primary-fixed-dim flex items-center justify-center">
              @if (store.profile().logo; as logo) {
                <img [src]="logo" [alt]="store.profile().name" class="w-28 h-28 object-contain rounded-2xl bg-white/90 p-2 shadow-lg mb-10" />
              } @else {
                <span class="material-symbols-outlined text-white/25 text-[120px] mb-10">content_cut</span>
              }
            </div>
            <div class="absolute inset-0 bg-linear-to-t from-inverse-surface/90 via-inverse-surface/30 to-transparent"></div>
            <div class="absolute top-space-md left-space-md right-space-md flex justify-between items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md font-label-sm text-label-sm border border-outline-variant/40 shadow-sm" [class]="status().open ? 'text-tertiary' : 'text-error'">
                <span class="w-2 h-2 rounded-full animate-pulse" [class]="status().open ? 'bg-tertiary' : 'bg-error'"></span>
                {{ (status().label) | translate }}
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface font-label-sm text-label-sm border border-outline-variant/40 shadow-sm">
                <span class="material-symbols-outlined text-secondary-container text-sm" style="font-variation-settings: 'FILL' 1;">star</span> {{ "New" | translate }}
              </span>
            </div>
            <div class="absolute bottom-space-md left-space-md right-space-md text-inverse-on-surface">
              <div class="inline-block bg-primary/80 backdrop-blur-sm text-on-primary text-label-sm font-label-sm px-2 py-0.5 rounded mb-1">{{ store.profile().category | translate }}</div>
              <h1 class="text-headline-lg font-headline-lg text-inverse-on-surface drop-shadow-sm leading-tight">{{ store.profile().name }}</h1>
              <p class="text-body-sm font-body-sm text-inverse-on-surface/90 flex items-center gap-1 mt-0.5"><span class="material-symbols-outlined text-sm">location_on</span> {{ area() }}</p>
            </div>
          </div>
          <div class="grid grid-cols-3 divide-x divide-outline-variant border-t border-outline-variant bg-surface-container-lowest text-center">
            <a class="flex flex-col sm:flex-row items-center justify-center gap-1 py-3 px-2 text-on-surface hover:bg-surface-container-low transition-colors duration-150 active:scale-95" [href]="'tel:+91' + phoneDigits()"><span class="material-symbols-outlined text-primary text-xl">call</span><span class="text-label-md font-label-md">{{ 'home.call' | translate }}</span></a>
            <a class="flex flex-col sm:flex-row items-center justify-center gap-1 py-3 px-2 text-on-surface hover:bg-surface-container-low transition-colors duration-150 active:scale-95" [href]="mapsUrl()" target="_blank" rel="noopener"><span class="material-symbols-outlined text-primary text-xl">directions</span><span class="text-label-md font-label-md">{{ 'home.directions' | translate }}</span></a>
            <button type="button" (click)="share()" class="flex flex-col sm:flex-row items-center justify-center gap-1 py-3 px-2 text-on-surface hover:bg-surface-container-low transition-colors duration-150 active:scale-95"><span class="material-symbols-outlined text-primary text-xl">share</span><span class="text-label-md font-label-md">{{ 'home.share' | translate }}</span></button>
          </div>
        </section>

        <section class="bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant elevation-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-md">
          <div class="flex items-center gap-space-sm">
            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined">schedule</span></div>
            <div>
              <span class="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider block">{{ 'home.hours' | translate }}</span>
              <p class="text-headline-sm font-headline-sm text-on-surface">{{ hoursToday() }}</p>
            </div>
          </div>
          <button type="button" (click)="book()" class="inline-flex items-center justify-center gap-space-xs px-space-lg py-3 rounded-xl bg-secondary-container text-on-secondary-container font-label-lg text-label-lg shadow-md hover:bg-secondary hover:text-on-secondary active:scale-95 transition-all duration-150">
            <span class="material-symbols-outlined text-lg">calendar_today</span><span>{{ 'common.bookNow' | translate }}</span>
          </button>
        </section>

        <section class="bg-surface-container-low/70 border border-outline-variant/70 rounded-xl p-space-sm px-space-md flex items-center justify-center gap-space-sm text-center">
          <span class="material-symbols-outlined text-primary text-base">verified_user</span>
          <p class="text-label-md font-label-md text-on-surface-variant font-medium"><span class="text-primary font-bold">{{ 'home.sanitized' | translate }}</span> {{ "· Premium Styling Products" | translate }}</p>
        </section>

        <section class="space-y-space-md">
          <div class="flex items-center justify-between">
            <div><h2 class="text-headline-md font-headline-md text-on-surface">{{ 'home.popular' | translate }}</h2><p class="text-body-sm font-body-sm text-on-surface-variant">{{ 'home.popularSub' | translate }}</p></div>
            <a [routerLink]="['/s', store.profile().slug, 'services']" class="text-primary text-label-md font-label-md hover:underline flex items-center gap-0.5">{{ 'common.viewAll' | translate }} <span class="material-symbols-outlined text-sm">chevron_right</span></a>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            @for (s of popular(); track s.id) {
              <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md flex flex-col justify-between elevation-1 hover:elevation-2 transition-all duration-200 hover:-translate-y-0.5 group">
                <div class="flex gap-space-md items-start">
                  <div class="w-20 h-20 rounded-lg overflow-hidden bg-primary/10 shrink-0 border border-outline-variant/60 flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-300"><span class="material-symbols-outlined text-[36px]">{{ icon(s.category) }}</span></div>
                  <div class="flex-1 min-w-0">
                    <span class="inline-block px-2 py-0.5 rounded-full bg-surface-container text-outline text-label-sm font-label-sm mb-1">{{ s.duration }}m</span>
                    <h3 class="text-headline-sm font-headline-sm text-on-surface truncate">{{ s.name }}</h3>
                    <p class="text-body-sm font-body-sm text-on-surface-variant line-clamp-1 mt-0.5">{{ s.description }}</p>
                  </div>
                </div>
                <div class="flex items-center justify-between mt-space-md pt-space-sm border-t border-outline-variant/40">
                  <span class="text-headline-sm font-headline-sm text-on-surface font-bold">{{ inr(s.price) }}</span>
                  <button type="button" (click)="flow.toggle(s.id)" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-label-md font-label-md font-semibold transition-colors duration-150 active:scale-95" [class]="flow.has(s.id) ? 'bg-primary text-on-primary border-primary' : 'border-primary text-primary hover:bg-primary/10'">
                    <span class="material-symbols-outlined text-sm">{{ flow.has(s.id) ? 'done' : 'add' }}</span> {{ (flow.has(s.id) ? 'common.inCart' : 'common.add') | translate }}
                  </button>
                </div>
              </div>
            }
          </div>
        </section>
      </main>

      @if (flow.serviceIds().length) {
        <div class="fixed bottom-16 left-0 w-full z-40 px-space-md no-print">
          <div class="max-w-screen-md mx-auto bg-inverse-surface text-inverse-on-surface rounded-xl px-space-md py-2.5 shadow-xl flex items-center justify-between gap-3">
            <div><p class="text-label-md font-label-md font-bold">{{ flow.serviceIds().length }} {{ 'services.selected' | translate }}</p><p class="text-body-sm opacity-80">{{ "{{p1}} min · {{p2}}" | translate: { p1: (flow.totalDuration()), p2: (inr(flow.totalPrice())) } }}</p></div>
            <button type="button" (click)="book()" class="px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container font-label-lg text-label-lg font-bold active:scale-95">{{ 'common.bookNow' | translate }}</button>
          </div>
        </div>
      }
    }
  `,
})
export class CustomerHome {
  protected readonly store = inject(SalonStore);
  protected readonly flow = inject(BookingFlowStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly inr = inr;
  protected readonly icon = serviceIcon;

  protected readonly found = computed(() => this.route.snapshot.paramMap.get('slug') === this.store.profile().slug);
  protected readonly popular = computed(() => this.store.selectedServices().slice(0, 4));
  protected readonly phoneDigits = computed(() => this.store.profile().phone.replace(/\D/g, '').slice(-10));
  protected readonly area = computed(() => [this.store.profile().landmark.split(',').pop()?.trim(), this.store.profile().city].filter(Boolean).join(', '));
  protected readonly mapsUrl = computed(() => `https://www.google.com/maps/search/?api=1&query=${this.store.profile().lat},${this.store.profile().lng}`);
  private readonly today = dateKey(new Date());

  protected readonly status = computed(() => {
    const t = this.store.dayTiming(this.today);
    const now = this.store.nowMin();
    if (!t.open) return { open: false, label: tr('Closed today') };
    const [sh, sm] = t.start.split(':').map(Number);
    const [eh, em] = t.end.split(':').map(Number);
    if (now < sh * 60 + sm) return { open: false, label: tr('Opens {{p1}}', { p1: fmt12Str(t.start) }) };
    if (now >= eh * 60 + em) return { open: false, label: tr('Closed for today') };
    return { open: true, label: tr('Open Now · Closes {{p1}}', { p1: fmt12Str(t.end) }) };
  });
  protected readonly hoursToday = computed(() => {
    const t = this.store.dayTiming(this.today);
    return t.open ? tr('Today {{p1}} – {{p2}}', { p1: fmt12Str(t.start), p2: fmt12Str(t.end) }) : tr('Closed today');
  });

  book() {
    this.router.navigate(['/s', this.store.profile().slug, 'services']);
  }

  async share() {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: this.store.profile().name, url });
      else {
        await navigator.clipboard.writeText(url);
        this.toast.success('Salon link copied');
      }
    } catch { /* share dismissed */ }
  }
}
