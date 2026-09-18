import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { UiService } from '../../../core/services/ui.service';
import { dateKey, downloadText, inr, toCsv } from '../../../core/utils/time';
import { Topbar } from '../../../shared/layout/topbar';
import { DonutChart } from '../../../shared/ui/donut-chart';
import { LineChart } from '../../../shared/ui/line-chart';
import { PERIODS, PeriodKey } from './reports.data';

@Component({
  selector: 'app-reports',
  imports: [RouterLink, Topbar, LineChart, DonutChart],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-4">
        <div class="hidden sm:flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/40">
          <span class="material-symbols-outlined text-primary text-[18px]">location_on</span>
          <span class="font-label-lg text-label-lg text-on-surface truncate max-w-56">{{ store.profile().name }}</span>
        </div>
        <div class="flex items-center bg-surface-container rounded-lg p-1 border border-outline-variant/20" role="tablist">
          @for (p of periods; track p.key) {
            <button type="button" role="tab" [attr.aria-selected]="period() === p.key" (click)="period.set(p.key)" class="px-3 py-1 rounded-md font-label-md text-label-md transition-colors" [class]="period() === p.key ? 'bg-surface-container-lowest text-primary font-bold shadow-xs' : 'text-on-surface-variant hover:text-on-surface'">{{ p.label }}</button>
          }
        </div>
      </div>
      <ng-container right>
        <div class="relative group">
          <button type="button" class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container active:scale-95 transition-all shadow-xs"><span class="material-symbols-outlined text-[18px]">ios_share</span><span class="hidden sm:inline">Export Report</span><span class="material-symbols-outlined text-[16px]">expand_more</span></button>
          <div class="hidden group-hover:flex group-focus-within:flex flex-col absolute right-0 pt-1 w-52 z-50">
            <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-lg p-1 flex flex-col">
              <button type="button" (click)="exportCsv()" class="flex items-center gap-2.5 px-3 py-2 text-left text-on-surface hover:bg-surface-container rounded-lg font-label-md text-label-md transition-colors"><span class="material-symbols-outlined text-primary text-[18px]">description</span><span>Download CSV (.csv)</span></button>
              <button type="button" (click)="exportPdf()" class="flex items-center gap-2.5 px-3 py-2 text-left text-on-surface hover:bg-surface-container rounded-lg font-label-md text-label-md transition-colors"><span class="material-symbols-outlined text-secondary text-[18px]">picture_as_pdf</span><span>Export Executive PDF</span></button>
            </div>
          </div>
        </div>
        <button type="button" (click)="ui.walkInModal.set(true)" class="hidden md:block px-3 py-1.5 rounded-lg border border-primary text-primary font-label-lg text-label-lg hover:bg-primary/5 transition-colors">Add Walk-in</button>
      </ng-container>
    </app-topbar>

    <main class="lg:pl-64 pt-16 flex-1 flex flex-col min-h-screen bg-background">
      <div class="px-4 md:px-8 py-7">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div class="flex items-center gap-2 font-body-sm text-body-sm text-tertiary mb-1"><span>Analytics</span><span class="text-outline-variant">•</span><span>Financial Suite</span><span class="text-outline-variant">•</span><span class="text-primary font-medium">{{ d().range }}</span></div>
            <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface tracking-tight">Financial Analytics &amp; Salon Insights</h1>
          </div>
          <div class="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant font-label-sm text-label-sm"><span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span><span>{{ d().compare }}</span></div>
        </div>

        @if (!insightHidden()) {
          <div class="mb-7 p-4 bg-surface-container-lowest border-l-4 border-primary rounded-xl shadow-level-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-start gap-3.5">
              <div class="p-2 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[22px]">bolt</span></div>
              <div>
                <div class="flex items-center gap-2"><span class="font-headline-sm text-headline-sm text-on-surface font-bold">Actionable Operations Insight</span><span class="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">High Priority</span></div>
                <p class="font-body-md text-body-md text-tertiary mt-0.5">{{ d().insight }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <a routerLink="/owner/staff" class="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-xs">Adjust Staff Roster</a>
              <button type="button" aria-label="Dismiss insight" (click)="insightHidden.set(true)" class="p-1.5 rounded-lg text-tertiary hover:bg-surface-container transition-colors"><span class="material-symbols-outlined text-[18px]">close</span></button>
            </div>
          </div>
        }

        <section aria-label="Financial Summary Key Metrics" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-7">
          <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-level-1 hover:border-primary/40 transition-all flex flex-col justify-between">
            <div class="flex items-start justify-between"><div class="flex flex-col"><span class="font-label-md text-label-md text-tertiary">Net Revenue</span><span class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface mt-1">{{ inr(d().revenue) }}</span></div><div class="p-2.5 rounded-xl bg-primary/10 text-primary"><span class="material-symbols-outlined text-[24px]">payments</span></div></div>
            <div class="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between font-label-sm text-label-sm"><span class="inline-flex items-center gap-1 text-primary font-semibold"><span class="material-symbols-outlined text-[16px]">trending_up</span> +{{ revDelta() }}%</span><span class="text-tertiary">vs {{ inr(d().prevRevenue) }} prev.</span></div>
          </div>
          <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-level-1 hover:border-primary/40 transition-all flex flex-col justify-between">
            <div class="flex items-start justify-between"><div class="flex flex-col"><span class="font-label-md text-label-md text-tertiary">Total Footfall</span><span class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface mt-1">{{ d().footfall }}</span></div><div class="p-2.5 rounded-xl bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[24px]">group</span></div></div>
            <div class="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between font-label-sm text-label-sm"><span class="inline-flex items-center gap-1 text-primary font-semibold"><span class="material-symbols-outlined text-[16px]">trending_up</span> +{{ d().footfallDelta }}%</span><span class="text-tertiary">{{ d().booked }} booked • {{ d().walkin }} walk-in</span></div>
          </div>
          <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-level-1 hover:border-primary/40 transition-all flex flex-col justify-between">
            <div class="flex items-start justify-between"><div class="flex flex-col"><span class="font-label-md text-label-md text-tertiary">Average Ticket Size</span><span class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface mt-1">{{ inr(d().avgTicket) }}</span></div><div class="p-2.5 rounded-xl bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[24px]">receipt_long</span></div></div>
            <div class="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between font-label-sm text-label-sm"><span class="inline-flex items-center gap-1 text-primary font-semibold"><span class="material-symbols-outlined text-[16px]">trending_up</span> +{{ d().avgDelta }}%</span><span class="text-tertiary">per completed bill</span></div>
          </div>
          <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-level-1 hover:border-primary/40 transition-all flex flex-col justify-between">
            <div class="flex items-start justify-between"><div class="flex flex-col"><span class="font-label-md text-label-md text-tertiary">Customer Retention Rate</span><span class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface mt-1">{{ d().retention }}%</span></div><div class="p-2.5 rounded-xl bg-secondary/10 text-secondary"><span class="material-symbols-outlined text-[24px]">loyalty</span></div></div>
            <div class="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between font-label-sm text-label-sm"><span class="inline-flex items-center gap-1 text-primary font-semibold"><span class="material-symbols-outlined text-[16px]">arrow_upward</span> +{{ d().retentionDelta }}%</span><span class="text-tertiary">{{ d().returning }} returning patrons</span></div>
          </div>
        </section>

        <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-7">
          <div class="lg:col-span-8 bg-surface-container-lowest p-4 md:p-6 rounded-2xl border border-outline-variant/20 shadow-level-1 flex flex-col justify-between">
            <div>
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div><h2 class="font-headline-sm text-headline-sm font-bold text-on-surface">Earnings &amp; Revenue Trend</h2><p class="font-body-sm text-body-sm text-tertiary">Revenue velocity compared against the previous period</p></div>
                <div class="flex items-center gap-4 font-label-sm text-label-sm">
                  <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-primary"></span><span class="text-on-surface font-medium">This Period</span></div>
                  <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-outline-variant/70"></span><span class="text-tertiary">Previous</span></div>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-x-6 gap-y-1 py-2 px-3.5 bg-surface-container-low rounded-xl mb-4 text-body-sm">
                <div><span class="text-tertiary">Peak:</span> <span class="font-semibold text-on-surface ml-1">{{ peakLabel() }} ({{ inr(peak()) }})</span></div>
                <div class="h-3.5 w-px bg-outline-variant/30 hidden sm:block"></div>
                <div><span class="text-tertiary">Average:</span> <span class="font-semibold text-on-surface ml-1">{{ inr(avg()) }}</span></div>
                <div class="h-3.5 w-px bg-outline-variant/30 hidden sm:block"></div>
                <div class="hidden sm:block"><span class="text-tertiary">Growth:</span> <span class="font-semibold text-primary ml-1">+{{ revDelta() }}%</span></div>
              </div>
            </div>
            <div class="relative w-full h-64 pt-2 pl-10 cursor-crosshair" (mousemove)="hover($event)" (mouseleave)="hoverIdx.set(null)" role="img" aria-label="Revenue trend chart">
              <div class="absolute inset-0 flex flex-col justify-between pointer-events-none text-tertiary font-label-sm text-label-sm opacity-50">
                @for (g of grid(); track g) { <div class="border-b border-outline-variant/20 flex justify-between pr-2"><span>{{ g }}</span></div> }
              </div>
              <app-line-chart [series]="series()" [yMax]="yMax()" />
              @if (hoverIdx() !== null) {
                <div class="absolute top-2 bg-inverse-surface text-inverse-on-surface px-3 py-1.5 rounded-lg shadow-lg pointer-events-none text-left z-10" [style.left]="'calc(' + hoverPct() + '% * 0.94 + 2.5rem)'">
                  <span class="font-label-sm text-label-sm block text-inverse-primary font-bold">{{ hoverLabel() }}</span><span class="font-body-md text-body-md font-bold">{{ inr(d().current[hoverIdx()!]) }}</span>
                </div>
              }
            </div>
            <div class="flex justify-between items-center text-tertiary font-label-sm text-label-sm pt-4 border-t border-outline-variant/20 mt-2 pl-10">
              @for (l of d().labels; track l) { <span>{{ l }}</span> }
            </div>
          </div>

          <div class="lg:col-span-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-level-1 flex flex-col justify-between">
            <div><div class="flex items-center justify-between mb-1"><h2 class="font-headline-sm text-headline-sm font-bold text-on-surface">Payment Split</h2></div><p class="font-body-sm text-body-sm text-tertiary mb-4">Channels of completed settlements</p></div>
            <app-donut-chart [segments]="donut()">
              <span class="font-label-sm text-label-sm text-tertiary">Total Received</span>
              <span class="font-headline-md text-headline-md font-bold text-on-surface">{{ short(d().revenue) }}</span>
              <span class="text-[11px] text-primary font-semibold">100% Settled</span>
            </app-donut-chart>
            <div class="grid grid-cols-2 gap-2.5 pt-4 border-t border-outline-variant/20 mt-3">
              @for (s of donut(); track s.label) {
                <div class="flex items-center justify-between p-2 rounded-lg bg-surface-container-low"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background]="s.color"></span><span class="font-medium text-on-surface text-label-sm">{{ s.label }}</span></div><span class="font-bold text-on-surface text-label-sm">{{ s.value }}%</span></div>
              }
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div class="lg:col-span-8 bg-surface-container-lowest p-4 md:p-6 rounded-2xl border border-outline-variant/20 shadow-level-1 flex flex-col justify-between">
            <div>
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div><h2 class="font-headline-sm text-headline-sm font-bold text-on-surface">Top Performing Services</h2><p class="font-body-sm text-body-sm text-tertiary">Ranked by volume count &amp; total gross revenue</p></div>
                <div class="flex items-center gap-2">
                  <button type="button" (click)="sortBy.set('revenue')" class="px-3 py-1 text-label-sm rounded-lg transition-colors" [class]="sortBy() === 'revenue' ? 'bg-primary/10 text-primary font-semibold' : 'text-tertiary hover:bg-surface-container'">By Revenue</button>
                  <button type="button" (click)="sortBy.set('volume')" class="px-3 py-1 text-label-sm rounded-lg transition-colors" [class]="sortBy() === 'volume' ? 'bg-primary/10 text-primary font-semibold' : 'text-tertiary hover:bg-surface-container'">By Bookings</button>
                </div>
              </div>
              <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left border-collapse min-w-[520px]">
                  <thead><tr class="border-b border-outline-variant/30 text-tertiary font-label-sm text-label-sm"><th class="pb-3 pl-1 font-semibold"># SERVICE NAME</th><th class="pb-3 text-center font-semibold">VOLUME</th><th class="pb-3 font-semibold">REVENUE SHARE</th><th class="pb-3 text-right pr-1 font-semibold">GROSS VALUE</th></tr></thead>
                  <tbody class="divide-y divide-outline-variant/15 font-body-md text-body-md">
                    @for (s of services(); track s.name; let i = $index) {
                      <tr class="hover:bg-surface-container/40 transition-colors">
                        <td class="py-3.5 pl-1"><div class="flex items-center gap-3"><span class="w-6 h-6 rounded-md flex items-center justify-center font-bold text-label-sm shrink-0" [class]="i === 0 ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container-high text-on-surface'">{{ i + 1 }}</span><div><span class="font-bold text-on-surface block">{{ s.name }}</span><span class="font-body-sm text-body-sm text-tertiary">{{ s.meta }}</span></div></div></td>
                        <td class="py-3.5 text-center font-semibold text-on-surface">{{ s.volume }} <span class="text-tertiary text-body-sm font-normal">slots</span></td>
                        <td class="py-3.5 w-1/3"><div class="w-full bg-surface-container rounded-full h-2.5 overflow-hidden"><div class="bg-primary h-2.5 rounded-full transition-all" [style.width.%]="s.bar"></div></div><span class="text-[11px] text-tertiary block mt-1 font-medium">{{ s.share }}% of gross billing</span></td>
                        <td class="py-3.5 text-right pr-1 font-bold text-on-surface">{{ inr(s.revenue) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-outline-variant/20 flex items-center justify-between"><span class="font-body-sm text-body-sm text-tertiary">Showing {{ services().length }} of {{ store.selectedServices().length }} catalog services</span></div>
          </div>

          <div class="lg:col-span-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-level-1 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-1"><h2 class="font-headline-sm text-headline-sm font-bold text-on-surface">Category Margins</h2><span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">Profits</span></div>
              <p class="font-body-sm text-body-sm text-tertiary mb-5">Net margin after staff commissions &amp; consumables</p>
              <div class="space-y-4">
                @for (m of margins(); track m.name) {
                  <div>
                    <div class="flex justify-between items-center mb-1"><span class="font-label-md text-label-md text-on-surface font-semibold">{{ m.name }}</span><span class="font-label-md text-label-md font-bold" [class]="m.pct < 50 ? 'text-secondary' : 'text-primary'">{{ m.pct }}% margin</span></div>
                    <div class="w-full bg-surface-container rounded-full h-2"><div class="h-2 rounded-full transition-all" [class]="m.pct < 50 ? 'bg-secondary' : 'bg-primary'" [style.width.%]="m.pct"></div></div>
                    <div class="flex justify-between text-[11px] text-tertiary mt-1"><span>Revenue: {{ inr(m.revenue) }}</span><span>{{ m.costLabel }}: {{ inr(m.cost) }}</span></div>
                  </div>
                }
              </div>
            </div>
            <div class="mt-6 pt-4 border-t border-outline-variant/20 bg-surface-container-low p-3.5 rounded-xl">
              <div class="flex items-center justify-between"><span class="font-label-sm text-label-sm text-tertiary font-medium">Total Consumable Cost</span><span class="font-headline-sm text-headline-sm font-bold text-on-surface">{{ inr(totalCost()) }}</span></div>
              <div class="flex items-center justify-between mt-1"><span class="font-label-sm text-label-sm text-tertiary font-medium">Estimated Net Salon Profit</span><span class="font-headline-sm text-headline-sm font-bold text-primary">{{ inr(netProfit()) }}</span></div>
            </div>
          </div>
        </section>

        <footer class="pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between text-tertiary font-body-sm text-body-sm gap-2">
          <div class="flex items-center gap-3"><span class="flex items-center gap-1 text-primary"><span class="material-symbols-outlined text-[16px]">check_circle</span> GST Compliant Invoicing</span></div>
          <div>Powered by <span class="font-semibold text-primary">Chairly</span></div>
        </footer>
      </div>
    </main>
  `,
})
export class Reports {
  protected readonly store = inject(SalonStore);
  protected readonly ui = inject(UiService);
  protected readonly toast = inject(ToastService);
  protected readonly inr = inr;
  protected readonly periods = Object.values(PERIODS);

  protected readonly period = signal<PeriodKey>('month');
  protected readonly sortBy = signal<'revenue' | 'volume'>('revenue');
  protected readonly insightHidden = signal(false);
  protected readonly hoverIdx = signal<number | null>(null);

  protected readonly d = computed(() => PERIODS[this.period()]);
  protected readonly revDelta = computed(() => (((this.d().revenue - this.d().prevRevenue) / this.d().prevRevenue) * 100).toFixed(1));
  protected readonly peak = computed(() => Math.max(...this.d().current));
  protected readonly peakLabel = computed(() => this.pointLabel(this.d().current.indexOf(this.peak())));
  protected readonly avg = computed(() => Math.round(this.d().current.reduce((a, b) => a + b, 0) / this.d().current.length));
  protected readonly yMax = computed(() => {
    const m = Math.max(...this.d().current, ...this.d().previous);
    const step = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / step) * step;
  });
  protected readonly grid = computed(() => [1, 0.75, 0.5, 0.25, 0].map((f) => this.short(this.yMax() * f, true)));
  protected readonly series = computed(() => [
    { values: this.d().previous, color: '#bcc9c5', dashed: true, area: true, width: 2 },
    { values: this.d().current, color: '#00685b', area: true, width: 3.2, marker: true },
  ]);
  protected readonly hoverPct = computed(() => {
    const i = this.hoverIdx();
    return i === null ? 0 : (i / (this.d().current.length - 1)) * 100;
  });
  protected readonly hoverLabel = computed(() => this.pointLabel(this.hoverIdx() ?? 0));
  protected readonly donut = computed(() => {
    const p = this.d().payment;
    return [
      { label: 'UPI Instant', value: p.upi, color: '#00685b' },
      { label: 'Cards', value: p.card, color: '#fd7958' },
      { label: 'Cash POS', value: p.cash, color: '#68777b' },
      { label: 'Vouchers', value: p.voucher, color: '#83f6e0' },
    ];
  });
  protected readonly services = computed(() => {
    const key = this.sortBy();
    const list = [...this.d().services].sort((a, b) => b[key] - a[key]);
    const max = Math.max(...list.map((s) => s[key]));
    return list.map((s) => ({ ...s, bar: Math.round((s[key] / max) * 100), share: ((s.revenue / this.d().revenue) * 100).toFixed(1) }));
  });
  protected readonly margins = computed(() => this.d().margins.map((m) => ({ ...m, pct: Math.round(((m.revenue - m.cost) / m.revenue) * 100) })));
  protected readonly totalCost = computed(() => this.d().margins.reduce((a, m) => a + m.cost, 0));
  protected readonly netProfit = computed(() => this.d().margins.reduce((a, m) => a + (m.revenue - m.cost), 0));

  pointLabel(i: number) {
    const d = this.d();
    if (d.labels.length === d.current.length) return d.labels[i];
    return `Day ${Math.round(1 + (i * 23) / Math.max(1, d.current.length - 1))}`;
  }

  short(n: number, axis = false) {
    if (n >= 100000 && !axis) return '₹' + (n / 100000).toFixed(2) + 'L';
    if (n >= 1000) return '₹' + Math.round(n / 1000) + 'k';
    return '₹' + Math.round(n);
  }

  hover(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const plot = r.width - 40;
    const x = Math.min(plot, Math.max(0, e.clientX - r.left - 40));
    this.hoverIdx.set(Math.round((x / plot) * (this.d().current.length - 1)));
  }

  exportCsv() {
    const d = this.d();
    downloadText(`report-${d.key}-${dateKey(new Date())}.csv`, toCsv([
      ['Period', d.range], ['Net revenue', d.revenue], ['Previous revenue', d.prevRevenue], ['Footfall', d.footfall], ['Average ticket', d.avgTicket], ['Retention %', d.retention], [],
      ['Service', 'Volume', 'Revenue'], ...d.services.map((s) => [s.name, s.volume, s.revenue]), [],
      ['Trend point', 'Current', 'Previous'], ...d.current.map((v, i) => [i + 1, v, d.previous[i]]),
    ]));
    this.toast.success('Report exported as CSV');
  }

  exportPdf() {
    this.toast.info('Choose "Save as PDF" in the print dialog');
    setTimeout(() => window.print(), 300);
  }
}
