import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/services/admin.store';
import { inr } from '../../core/utils/time';
import { DonutChart } from '../../shared/ui/donut-chart';
import { LineChart } from '../../shared/ui/line-chart';

const COLORS = ['#68777b', '#00685b', '#fd7958'];

@Component({
  selector: 'app-admin-overview',
  imports: [RouterLink, LineChart, DonutChart],
  template: `
    <div class="p-4 md:p-8 flex flex-col gap-6 max-w-[1400px] mx-auto">
      <div>
        <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">Overview</h1>
        <p class="font-body-md text-body-md text-outline">Salons, trials, subscribers and recurring revenue across Chairly.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        @for (k of kpis(); track k.label) {
          <div class="p-5 rounded-[16px] bg-surface-container-lowest border border-outline-variant/30 shadow-level-1 hover:shadow-level-2 transition-all flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div class="flex flex-col"><span class="font-label-md text-label-md text-outline font-medium">{{ k.label }}</span><span class="font-headline-xl text-headline-xl-mobile md:text-headline-xl text-on-surface tracking-tight mt-1">{{ k.value }}</span></div>
              <div class="w-10 h-10 rounded-xl flex items-center justify-center" [class]="k.tone"><span class="material-symbols-outlined text-[22px]">{{ k.icon }}</span></div>
            </div>
            <p class="mt-4 pt-3 border-t border-outline-variant/20 font-label-sm text-label-sm text-outline">{{ k.note }}</p>
          </div>
        }
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div class="lg:col-span-8 bg-surface-container-lowest p-5 md:p-6 rounded-2xl border border-outline-variant/20 shadow-level-1">
          <div class="flex items-center justify-between mb-4"><div><h2 class="font-headline-sm text-headline-sm font-bold text-on-surface">New Salon Signups</h2><p class="font-body-sm text-body-sm text-muted">Last 8 weeks</p></div><span class="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-bold">{{ signupTotal }} total</span></div>
          <div class="h-56 w-full pt-2"><app-line-chart [series]="[{ values: store.signups, color: '#00685b', area: true, marker: true }]" /></div>
          <div class="flex justify-between text-muted font-label-sm text-label-sm pt-3 border-t border-outline-variant/20 mt-2">@for (w of weeks; track w) { <span>{{ w }}</span> }</div>
        </div>

        <div class="lg:col-span-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-level-1">
          <h2 class="font-headline-sm text-headline-sm font-bold text-on-surface">Plan Mix</h2>
          <p class="font-body-sm text-body-sm text-muted mb-2">Active subscribers by plan</p>
          <app-donut-chart [segments]="donut()"><span class="font-label-sm text-label-sm text-muted">Subscribers</span><span class="font-headline-md text-headline-md font-bold text-on-surface">{{ store.totals().subscribers }}</span></app-donut-chart>
          <div class="grid grid-cols-1 gap-2 pt-3 border-t border-outline-variant/20">
            @for (s of donut(); track s.label) { <div class="flex items-center justify-between p-2 rounded-lg bg-surface-container-low"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full" [style.background]="s.color"></span><span class="font-medium text-on-surface text-label-sm">{{ s.label }}</span></div><span class="font-bold text-on-surface text-label-sm">{{ s.value }}</span></div> }
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-surface-container-lowest p-5 md:p-6 rounded-2xl border border-outline-variant/20 shadow-level-1">
          <div class="flex items-center justify-between mb-4"><h2 class="font-headline-sm text-headline-sm font-bold text-on-surface">Trials ending soon</h2><a routerLink="/admin/salons" class="text-primary font-label-md text-label-md font-semibold hover:underline">View all</a></div>
          <div class="flex flex-col gap-2.5">
            @for (t of expiring(); track t.id) {
              <div class="p-3 rounded-xl bg-surface-container-low/40 border border-outline-variant/20 flex items-center justify-between gap-2">
                <div class="min-w-0"><p class="font-label-lg text-label-lg font-bold text-on-surface truncate">{{ t.name }}</p><p class="text-body-sm text-muted">{{ t.owner }} • {{ t.city }}</p></div>
                <span class="px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold shrink-0" [class]="store.daysLeft(t.trialEndsAt) <= 3 ? 'bg-error-container text-on-error-container' : 'bg-amber-100 text-amber-900'">{{ store.daysLeft(t.trialEndsAt) }} day{{ store.daysLeft(t.trialEndsAt) === 1 ? '' : 's' }} left</span>
              </div>
            } @empty { <p class="text-body-sm text-outline py-4">No trials ending in the next 7 days.</p> }
          </div>
        </div>
        <div class="bg-surface-container-lowest p-5 md:p-6 rounded-2xl border border-outline-variant/20 shadow-level-1">
          <div class="flex items-center justify-between mb-4"><h2 class="font-headline-sm text-headline-sm font-bold text-on-surface">Recently joined</h2></div>
          <div class="flex flex-col gap-2.5">
            @for (r of recent(); track r.id) {
              <div class="p-3 rounded-xl bg-surface-container-low/40 border border-outline-variant/20 flex items-center justify-between gap-2">
                <div class="min-w-0"><p class="font-label-lg text-label-lg font-bold text-on-surface truncate">{{ r.name }}</p><p class="text-body-sm text-muted">{{ r.city }} • {{ r.staff }} staff</p></div>
                <span class="text-body-sm text-outline shrink-0">{{ r.joinedAt }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AdminOverview {
  protected readonly store = inject(AdminStore);
  protected readonly weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
  protected readonly signupTotal = this.store.signups.reduce((a, b) => a + b, 0);

  protected readonly kpis = computed(() => {
    const t = this.store.totals();
    return [
      { label: 'Total Salons', value: t.salons, icon: 'storefront', tone: 'bg-primary/10 text-primary', note: `${t.suspended} suspended or expired` },
      { label: 'On Free Trial', value: t.trials, icon: 'hourglass_top', tone: 'bg-amber-500/10 text-amber-700', note: '14-day trial on signup' },
      { label: 'Subscribers', value: t.subscribers, icon: 'verified', tone: 'bg-surface-container text-muted', note: `${Math.round((t.subscribers / Math.max(1, t.salons)) * 100)}% of all salons` },
      { label: 'Monthly Revenue', value: inr(t.mrr), icon: 'payments', tone: 'bg-secondary/10 text-secondary', note: 'Recurring, from active plans' },
    ];
  });
  protected readonly donut = computed(() => this.store.planCounts().map((p, i) => ({ label: p.plan.name, value: p.count, color: COLORS[i] })));
  protected readonly expiring = computed(() => this.store.rows().filter((x) => x.status === 'trial' && this.store.daysLeft(x.trialEndsAt) <= 7).sort((a, b) => a.trialEndsAt.localeCompare(b.trialEndsAt)));
  protected readonly recent = computed(() => [...this.store.rows()].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 5));
}
