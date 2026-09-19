import { TranslatePipe } from '@ngx-translate/core';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { QueueItem } from '../../../core/models';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { UiService } from '../../../core/services/ui.service';
import { fmt12, inr, LOCALE } from '../../../core/utils/time';
import { tr } from '../../../core/utils/i18n';
import { Topbar } from '../../../shared/layout/topbar';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, Topbar, TranslatePipe],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-4 flex-1 max-w-lg">
        <div class="relative w-full max-w-xs">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input type="text" class="w-full pl-10 pr-3 py-1.5 bg-surface-container-low border border-outline-variant/50 rounded-xl text-on-surface font-body-md text-body-md placeholder:text-outline focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" [placeholder]="'Search client or service...' | translate" [attr.aria-label]="'Search queue' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
      </div>
      <ng-container right>
        <button type="button" class="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors relative" [title]="'Notifications' | translate" (click)="notify()">
          <span class="material-symbols-outlined text-[22px]">notifications</span>
          @if (waiting().length) { <span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-secondary ring-2 ring-surface-container-lowest"></span> }
        </button>
        <button type="button" class="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors" [title]="'Support & Help' | translate" (click)="toast.info('Partner support: support@chairly.app')">
          <span class="material-symbols-outlined text-[22px]">help</span>
        </button>
        <div class="hidden md:block h-6 w-px bg-outline-variant/40 mx-1"></div>
        <button type="button" (click)="ui.walkInModal.set(true)" class="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-variant/40 text-primary font-label-lg text-label-lg border border-primary/20 flex items-center gap-1.5 transition-all active:scale-95">
          <span class="material-symbols-outlined text-[18px]">person_add</span><span class="hidden sm:inline">{{ "Add Walk-in" | translate }}</span>
        </button>
        <a routerLink="/owner/quick-bill" class="px-4 py-2 rounded-xl bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary font-label-lg text-label-lg flex items-center gap-2 shadow-sm transition-all duration-150 active:scale-95">
          <span class="material-symbols-outlined text-[18px]">receipt_long</span><span class="hidden sm:inline">{{ "Quick Bill" | translate }}</span>
        </a>
      </ng-container>
    </app-topbar>

    <main class="lg:pl-64 pt-16 min-h-screen flex flex-col bg-background">
      <div class="p-4 md:p-8 flex flex-col gap-6 max-w-[1600px] w-full mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">{{ "Salon Owner Command Center" | translate }}</h1>
            <p class="font-body-md text-body-md text-outline">{{ "Real-time floor oversight, queue tracking, and revenue for today, {{p1}}." | translate: { p1: today() } }}</p>
          </div>
          <div class="flex items-center gap-2 self-start sm:self-auto">
            <div class="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-xl border border-outline-variant/30 shadow-level-1">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-dot"></span>
              <span class="font-label-md text-label-md text-on-surface font-medium">{{ "Floor Sync: Live" | translate }}</span>
              <span class="text-outline text-xs">• {{ fmt(store.nowMin()) }}</span>
            </div>
            <button type="button" class="p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant hover:text-primary transition-colors shadow-level-1" [title]="'Refresh Live Data' | translate" (click)="toast.success('Live data refreshed')">
              <span class="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <div class="p-5 rounded-[16px] bg-surface-container-lowest border border-outline-variant/30 shadow-level-1 hover:shadow-level-2 transition-all duration-200 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div class="flex flex-col">
                <span class="font-label-md text-label-md text-outline font-medium">{{ "Today's Earnings" | translate }}</span>
                <span class="font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight mt-1">{{ inr(earnings()) }}</span>
              </div>
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[22px]">payments</span></div>
            </div>
            <div class="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
              <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold whitespace-nowrap"><span class="material-symbols-outlined text-[14px]">trending_up</span><span>{{ vsYesterday() }}</span></div>
              <svg class="w-14 h-6 shrink-0 text-primary stroke-current fill-none stroke-2" viewBox="0 0 80 24"><path d="M 0 18 Q 20 22, 35 12 T 60 8 T 80 4"></path></svg>
            </div>
          </div>

          <div class="p-5 rounded-[16px] bg-surface-container-lowest border border-outline-variant/30 shadow-level-1 hover:shadow-level-2 transition-all duration-200 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div class="flex flex-col">
                <span class="font-label-md text-label-md text-outline font-medium">{{ "Total Bookings" | translate }}</span>
                <div class="flex items-baseline gap-2 mt-1"><span class="font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight">{{ totalBookings() }}</span><span class="font-label-sm text-label-sm text-outline">{{ "Slots filled" | translate }}</span></div>
              </div>
              <div class="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-muted"><span class="material-symbols-outlined text-[22px]">book_online</span></div>
            </div>
            <div class="mt-4 pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-label-sm text-label-sm">
              <div class="flex items-center gap-1.5 text-on-surface"><span class="w-2 h-2 rounded-full bg-primary"></span><span class="font-semibold">{{ doneCount() }}</span> {{ "Done" | translate }}</div>
              <div class="flex items-center gap-1.5 text-secondary"><span class="w-2 h-2 rounded-full bg-secondary-container"></span><span class="font-semibold">{{ totalBookings() - doneCount() }}</span> {{ "Pending" | translate }}</div>
              <div class="text-outline">{{ "{{p1}}% Concluded" | translate: { p1: (concluded()) } }}</div>
            </div>
          </div>

          <div class="p-5 rounded-[16px] bg-surface-container-lowest border border-outline-variant/30 shadow-level-1 hover:shadow-level-2 transition-all duration-200 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div class="flex flex-col">
                <span class="font-label-md text-label-md text-outline font-medium">{{ "Walk-ins vs App" | translate }}</span>
                <div class="flex items-baseline gap-2 mt-1"><span class="font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight">{{ walkins() }} <span class="text-muted font-body-md text-body-md font-normal">/</span> {{ online() }}</span></div>
              </div>
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[22px]">directions_walk</span></div>
            </div>
            <div class="mt-4 pt-3 border-t border-outline-variant/20 flex flex-col gap-1.5">
              <div class="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
                <div class="bg-primary h-full" [style.width.%]="walkinPct()" [title]="'Walk-ins: ' + walkins()"></div>
                <div class="bg-secondary-container h-full" [style.width.%]="onlinePct()" [title]="'Online: ' + online()"></div>
              </div>
              <div class="flex items-center justify-between font-label-sm text-label-sm text-outline">
                <span>{{ "Walk-ins:" | translate }} <b class="text-primary">{{ walkinPct() }}%</b></span>
                <span>{{ "Online:" | translate }} <b class="text-secondary">{{ onlinePct() }}%</b></span>
              </div>
            </div>
          </div>

          <div class="p-5 rounded-[16px] bg-surface-container-lowest border border-outline-variant/30 shadow-level-1 hover:shadow-level-2 transition-all duration-200 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div class="flex flex-col">
                <span class="font-label-md text-label-md text-outline font-medium">{{ "Payment Split" | translate }}</span>
                <div class="flex items-baseline gap-2 mt-1"><span class="font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight">{{ upiPct() }}% <span class="font-headline-sm text-headline-sm text-primary">UPI</span></span></div>
              </div>
              <div class="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[22px]">contactless</span></div>
            </div>
            <div class="mt-4 pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-label-sm text-label-sm">
              <div class="flex items-center gap-1.5 text-primary font-semibold"><span class="material-symbols-outlined text-[15px]">qr_code_2</span><span>{{ "UPI: {{p1}}" | translate: { p1: (inr(upi())) } }}</span></div>
              <div class="flex items-center gap-1.5 text-outline font-medium"><span class="material-symbols-outlined text-[15px]">local_atm</span><span>{{ "Cash: {{p1}}%" | translate: { p1: (100 - upiPct()) } }}</span></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div class="xl:col-span-8 bg-surface-container-lowest rounded-[16px] border border-outline-variant/30 shadow-level-1 p-4 md:p-6 flex flex-col gap-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[20px]">group</span></div>
                <div>
                  <h2 class="font-headline-md text-headline-md text-on-surface tracking-tight">{{ "Today's Salon Queue" | translate }}</h2>
                  <p class="font-body-sm text-body-sm text-outline">{{ "Real-time station allocations and service stage transitions" | translate }}</p>
                </div>
              </div>
              <div class="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 overflow-x-auto no-scrollbar">
                <button type="button" (click)="filter.set('All')" class="px-3 py-1 rounded-lg font-label-sm text-label-sm whitespace-nowrap transition-colors" [class]="filter() === 'All' ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs' : 'text-outline hover:text-on-surface font-medium'">{{ "All Stations ({{p1}})" | translate: { p1: (store.staff().length) } }}</button>
                @for (c of categories(); track c) {
                  <button type="button" (click)="filter.set(c)" class="px-3 py-1 rounded-lg font-label-sm text-label-sm whitespace-nowrap transition-colors" [class]="filter() === c ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs' : 'text-outline hover:text-on-surface font-medium'">{{ c | translate }}</button>
                }
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="flex flex-col gap-3 bg-surface-container-low/60 rounded-xl p-3 border border-outline-variant/20">
                <div class="flex items-center justify-between px-1">
                  <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span><span class="font-label-lg text-label-lg font-bold text-on-surface">{{ "Waiting" | translate }}</span></div>
                  <span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 text-label-sm font-bold">{{ "{{p1}} clients" | translate: { p1: (waiting().length) } }}</span>
                </div>
                @for (q of waiting(); track q.id) {
                  <div class="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs hover:shadow-level-2 transition-all duration-150 flex flex-col gap-2">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0"><h4 class="font-headline-sm text-headline-sm text-on-surface">{{ q.client }}</h4><span class="font-label-sm text-label-sm text-outline">{{ q.phone }}</span></div>
                      <span class="px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1 shrink-0" [class]="waitMin(q) >= 10 ? 'bg-amber-100 text-amber-900' : 'bg-surface-container text-muted'"><span class="material-symbols-outlined text-[13px]">schedule</span> {{ "{{p1}} min" | translate: { p1: (waitMin(q)) } }}</span>
                    </div>
                    <div class="flex items-center justify-between text-body-sm gap-2">
                      <span class="font-label-sm text-label-sm text-primary px-2 py-0.5 bg-primary/10 rounded-md truncate">{{ q.service }}</span>
                      <span class="font-headline-sm text-headline-sm text-on-surface font-semibold">{{ inr(q.price) }}</span>
                    </div>
                    <div class="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                      <span class="font-label-sm text-label-sm text-outline">{{ q.requestedStaffId ? ('Requested: {{p1}}' | translate: { p1: first(q.requestedStaffId) }) : ('Any Stylist' | translate) }}</span>
                      <button type="button" (click)="seat(q)" class="text-primary hover:text-primary-container font-label-sm text-label-sm font-semibold flex items-center gap-0.5">
                        {{ q.requestedStaffId ? ('Assign' | translate) : ('Seat Client' | translate) }} <span class="material-symbols-outlined text-[14px]">{{ q.requestedStaffId ? 'arrow_forward' : 'chair' }}</span>
                      </button>
                    </div>
                  </div>
                } @empty {
                  <p class="text-center text-body-sm text-outline py-6">{{ "No one waiting" | translate }}</p>
                }
              </div>

              <div class="flex flex-col gap-3 bg-surface-container-low/60 rounded-xl p-3 border border-primary/20 ring-1 ring-primary/10">
                <div class="flex items-center justify-between px-1">
                  <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse-dot"></span><span class="font-label-lg text-label-lg font-bold text-on-surface">{{ "In Chair" | translate }}</span></div>
                  <span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-label-sm font-bold">{{ "{{p1}} active" | translate: { p1: (inChair().length) } }}</span>
                </div>
                @for (q of inChair(); track q.id) {
                  <div class="p-3.5 rounded-xl bg-surface-container-lowest border-l-4 border-l-primary border-t border-r border-b border-outline-variant/30 shadow-xs hover:shadow-level-2 transition-all flex flex-col gap-2">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <h4 class="font-headline-sm text-headline-sm text-on-surface">{{ q.client }}</h4>
                        <span class="font-label-sm text-label-sm text-primary font-semibold flex items-center gap-1 mt-0.5"><span class="material-symbols-outlined text-[14px]">event_seat</span> {{ "{{p1}} - Station {{p2}}" | translate: { p1: (first(q.staffId)), p2: (q.station) } }}</span>
                      </div>
                      <span class="px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-semibold flex items-center gap-1 shrink-0"><span class="material-symbols-outlined text-[12px]">timer</span> {{ left(q) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2"><span class="font-label-sm text-label-sm text-muted px-2 py-0.5 bg-surface-container rounded-md truncate">{{ q.service }}</span><span class="font-headline-sm text-headline-sm text-on-surface font-semibold">{{ inr(q.price) }}</span></div>
                    <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden"><div class="bg-primary h-full transition-all" [style.width.%]="progress(q)"></div></div>
                    <div class="pt-1.5 flex items-center justify-between">
                      <span class="font-label-sm text-label-sm text-outline">{{ "Started: {{p1}}" | translate: { p1: (fmt(q.startedAt ?? 0)) } }}</span>
                      <a [routerLink]="'/owner/quick-bill'" [queryParams]="{ queueId: q.id }" class="text-secondary hover:text-on-secondary-container font-label-sm text-label-sm font-semibold">{{ progress(q) >= 80 ? ('Ready to checkout' | translate) : ('Generate Bill' | translate) }}</a>
                    </div>
                  </div>
                } @empty {
                  <p class="text-center text-body-sm text-outline py-6">{{ "All chairs are free" | translate }}</p>
                }
              </div>

              <div class="flex flex-col gap-3 bg-surface-container-low/60 rounded-xl p-3 border border-outline-variant/20">
                <div class="flex items-center justify-between px-1">
                  <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span><span class="font-label-lg text-label-lg font-bold text-on-surface">{{ "Done" | translate }}</span></div>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-label-sm font-bold">{{ "{{p1}} billed" | translate: { p1: (doneCount()) } }}</span>
                </div>
                @for (q of done(); track q.id) {
                  <div class="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col gap-2">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0"><h4 class="font-headline-sm text-headline-sm text-on-surface">{{ q.client }}</h4><span class="font-label-sm text-label-sm text-outline">{{ "Bill #{{p1}}" | translate: { p1: (shortNo(q.billNo)) } }}</span></div>
                      <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-label-sm text-label-sm font-semibold flex items-center gap-1 shrink-0"><span class="material-symbols-outlined text-[13px]">check_circle</span> {{ "Paid {{p1}}" | translate: { p1: (q.payMethod) } }}</span>
                    </div>
                    <div class="flex items-center justify-between text-body-sm"><span class="font-label-sm text-label-sm text-muted">{{ "Stylist: {{p1}}" | translate: { p1: (first(q.staffId)) } }}</span><span class="font-headline-sm text-headline-sm font-semibold text-emerald-700">{{ inr(q.price) }}</span></div>
                    <div class="pt-1.5 border-t border-outline-variant/20 flex items-center justify-between text-outline font-label-sm text-label-sm">
                      <span>{{ billTime(q) }}</span>
                      <button type="button" class="text-primary flex items-center gap-0.5 hover:underline" (click)="toast.info('Slip {{p1}} · {{p2}}', { p1: q.billNo, p2: inr(q.price) })"><span class="material-symbols-outlined text-[14px]">receipt</span> {{ "View slip" | translate }}</button>
                    </div>
                  </div>
                } @empty {
                  <p class="text-center text-body-sm text-outline py-6">{{ "No bills yet" | translate }}</p>
                }
              </div>
            </div>
          </div>

          <div class="xl:col-span-4 flex flex-col gap-6">
            <div class="bg-surface-container-lowest rounded-[16px] border border-outline-variant/30 shadow-level-1 p-5 flex flex-col gap-4">
              <div class="flex items-center justify-between gap-2">
                <div><h3 class="font-headline-sm text-headline-sm text-on-surface">{{ "Footfall & Rush Hours" | translate }}</h3><p class="font-body-sm text-body-sm text-outline">{{ "Bookings per shift, last 30 days" | translate }}</p></div>
                <span class="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-bold whitespace-nowrap">{{ "Peak: {{p1}}" | translate: { p1: (peak()) } }}</span>
              </div>
              <div class="pt-3 pb-1 flex flex-col gap-3">
                <div class="h-36 w-full flex items-end justify-between gap-2 px-1">
                  @for (b of rush(); track b.label) {
                    <div class="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer">
                      <span class="text-[10px] font-semibold transition-colors" [class]="b.now ? 'text-primary font-bold' : 'text-outline group-hover:text-primary'">{{ b.value }}</span>
                      <div class="w-full rounded-t-lg transition-all duration-200 relative" [class]="b.now ? 'bg-primary hover:bg-primary-container shadow-sm' : b.peak ? 'bg-primary-container/80 hover:bg-primary' : 'bg-surface-container hover:bg-primary/40'" [style.height.px]="b.h">
                        @if (b.now) { <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-secondary-container"></div> }
                      </div>
                      <span class="text-[11px] font-medium" [class]="b.now ? 'text-primary font-bold' : 'text-outline'">{{ b.now ? ('Now' | translate) : b.label }}</span>
                    </div>
                  }
                </div>
                <div class="flex items-center justify-between text-label-sm text-outline px-1 border-t border-outline-variant/20 pt-2">
                  <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-primary"></span><span>{{ "Current shift" | translate }}</span></div>
                  <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-primary-container/80"></span><span>{{ "Peak shift" | translate }}</span></div>
                </div>
              </div>
            </div>

            @if (topStylist(); as t) {
              <div class="bg-surface-container-lowest rounded-[16px] border border-outline-variant/30 shadow-level-1 p-4 flex items-center justify-between gap-3 hover:shadow-level-2 transition-all">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="relative shrink-0">
                    @if (t.staff.photo) { <img class="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20" [src]="t.staff.photo" [alt]="t.staff.name" /> }
                    @else { <div class="w-12 h-12 rounded-full ring-2 ring-primary/20 bg-primary-container text-on-primary-container flex items-center justify-center font-headline-sm text-headline-sm">{{ t.staff.name[0] }}</div> }
                  </div>
                  <div class="flex flex-col min-w-0"><span class="font-headline-sm text-headline-sm text-on-surface truncate">{{ t.staff.name }}</span><span class="font-label-sm text-label-sm text-outline">{{ "Top Stylist • {{p1}} Clients" | translate: { p1: (t.stats.clients) } }}</span></div>
                </div>
                <div class="flex flex-col items-end shrink-0"><span class="font-headline-sm text-headline-sm text-primary font-bold">{{ inr(t.stats.revenue) }}</span><span class="font-label-sm text-label-sm text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">{{ "This month" | translate }}</span></div>
              </div>
            }
          </div>
        </div>
      </div>
    </main>
  `,
})
export class Dashboard {
  protected readonly store = inject(SalonStore);
  private readonly analytics = inject(AnalyticsService);
  protected readonly toast = inject(ToastService);
  protected readonly ui = inject(UiService);
  protected readonly inr = inr;
  protected readonly fmt = fmt12;
  protected readonly today = computed(() => new Date().toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short' }));

  protected readonly search = signal('');
  protected readonly filter = signal('All');

  private readonly matches = (q: QueueItem) => {
    const s = this.search().trim().toLowerCase();
    const f = this.filter();
    return (f === 'All' || q.category === f) && (!s || q.client.toLowerCase().includes(s) || q.service.toLowerCase().includes(s));
  };
  protected readonly waiting = computed(() => this.store.queue().filter((q) => q.stage === 'waiting' && this.matches(q)));
  protected readonly inChair = computed(() => this.store.queue().filter((q) => q.stage === 'in-chair' && this.matches(q)));
  protected readonly done = computed(() => this.store.queue().filter((q) => q.stage === 'done' && this.matches(q)).reverse());
  protected readonly categories = computed(() => [...new Set(this.store.queue().map((q) => q.category))]);

  private readonly kpi = this.analytics.todayStats;
  protected readonly earnings = computed(() => this.kpi().earnings);
  protected readonly doneCount = computed(() => this.kpi().done);
  protected readonly totalBookings = computed(() => this.kpi().total);
  protected readonly concluded = computed(() => Math.round((this.doneCount() / Math.max(1, this.totalBookings())) * 100));
  protected readonly walkins = computed(() => this.kpi().walkins);
  protected readonly online = computed(() => this.kpi().online);
  protected readonly walkinPct = computed(() => Math.round((this.walkins() / Math.max(1, this.walkins() + this.online())) * 100));
  protected readonly onlinePct = computed(() => (this.walkins() + this.online() ? 100 - this.walkinPct() : 0));
  protected readonly vsYesterday = computed(() => {
    const d = this.analytics.periods().day;
    if (!d.prevRevenue) return tr('No sales yesterday');
    const p = Math.round(((d.revenue - d.prevRevenue) / d.prevRevenue) * 100);
    return tr('{{p1}}% vs yesterday', { p1: (p >= 0 ? '+' : '') + p });
  });
  protected readonly upi = computed(() => this.kpi().upi);
  protected readonly upiPct = computed(() => Math.round((this.upi() / Math.max(1, this.earnings())) * 100));

  protected readonly rush = computed(() => {
    const rows = this.analytics.rush();
    const hour = Math.floor(this.store.nowMin() / 60);
    const max = Math.max(1, ...rows.map((r) => r.value));
    const nowIdx = rows.reduce((acc, r, i) => (r.from <= hour ? i : acc), 0);
    const top = Math.max(...rows.map((r) => r.value));
    return rows.map((r, i) => ({ ...r, h: Math.max(r.value ? 6 : 2, Math.round((r.value / max) * 115)), now: i === nowIdx, peak: top > 0 && r.value === top }));
  });
  protected readonly peak = computed(() => this.rush().find((r) => r.peak)?.label ?? '');

  protected readonly topStylist = computed(() => {
    const best = [...this.analytics.staffStats()].sort((a, b) => b.revenue - a.revenue)[0];
    const staff = this.store.staffById(best?.staffId);
    return best && best.revenue > 0 && staff ? { staff, stats: best } : null;
  });

  first(id: string | null | undefined) {
    return this.store.staffById(id)?.name.split(' ')[0] ?? 'Any';
  }
  waitMin(q: QueueItem) {
    return Math.max(0, this.store.nowMin() - q.arrivedAt);
  }
  private elapsed(q: QueueItem) {
    return Math.max(0, this.store.nowMin() - (q.startedAt ?? this.store.nowMin()));
  }
  left(q: QueueItem) {
    const l = q.duration - this.elapsed(q);
    return l > 0 ? tr('{{p1}}m left', { p1: l }) : tr('Overtime');
  }
  progress(q: QueueItem) {
    return Math.min(100, Math.round((this.elapsed(q) / Math.max(1, q.duration)) * 100));
  }
  shortNo(no?: string) {
    return no?.split('/').pop() ?? '';
  }
  billTime(q: QueueItem) {
    return q.billedAt ? new Date(q.billedAt).toLocaleTimeString(LOCALE(), { hour: '2-digit', minute: '2-digit' }) : '';
  }

  seat(q: QueueItem) {
    const err = this.store.seat(q.id);
    if (err) return this.toast.error(err);
    this.toast.success('{{p1}} is being seated', { p1: q.client });
  }

  notify() {
    const n = this.waiting().length;
    if (!n) this.toast.info('No new notifications');
    else this.toast.info(n > 1 ? '{{p1}} clients waiting for a chair' : '{{p1}} client waiting for a chair', { p1: n });
  }

}
