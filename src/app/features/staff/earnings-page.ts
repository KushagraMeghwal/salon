import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { dateKey, downloadText, initials, inr, toCsv } from '../../core/utils/time';

type Period = 'today' | 'week' | 'month';

@Component({
  selector: 'app-staff-earnings',
  imports: [TranslatePipe],
  template: `
    <div class="px-space-md pt-3 pb-2 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-9 h-9 rounded-full bg-primary-container text-on-primary font-headline-sm flex items-center justify-center font-bold shrink-0">{{ initials(me()?.name ?? '') }}</div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5"><h1 class="font-headline-sm text-headline-sm text-on-surface truncate">{{ me()?.name }}</h1><span class="w-2 h-2 rounded-full bg-tertiary-container inline-block"></span></div>
          <p class="font-label-sm text-label-sm text-on-surface-variant truncate">Chair #{{ chair() }} • {{ me()?.role }}</p>
        </div>
      </div>
    </div>

    <main class="flex-1 px-space-md py-space-sm space-y-4">
      <div class="bg-surface-container-low p-1 rounded-xl flex items-center justify-between text-label-md font-label-md" role="tablist">
        @for (p of periods; track p.key) {
          <button type="button" role="tab" [attr.aria-selected]="period() === p.key" (click)="period.set(p.key)" class="flex-1 py-1.5 rounded-lg text-center transition-colors" [class]="period() === p.key ? 'font-semibold bg-surface-container-lowest text-primary shadow-sm' : 'font-medium text-on-surface-variant hover:text-primary'">{{ p.label | translate }}</button>
        }
      </div>

      <div class="rounded-2xl p-5 bg-linear-to-br from-primary via-[#027566] to-primary-container text-on-primary elevation-level-2 relative overflow-hidden">
        <div class="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div class="flex justify-between items-start mb-2 relative z-10 gap-2">
          <span class="text-label-md font-label-md text-primary-fixed uppercase tracking-wider font-semibold">{{ 'staff.netEarnings' | translate }}</span>
          @if (growth() !== null) { <div class="flex items-center gap-1 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[11px] text-white font-semibold whitespace-nowrap"><span class="material-symbols-outlined text-[14px]">{{ growth()! >= 0 ? 'trending_up' : 'trending_down' }}</span><span>{{ growth()! >= 0 ? '+' : '' }}{{ growth() }}% vs last {{ period() }}</span></div> }
        </div>
        <div class="font-numeric-stat text-numeric-stat font-bold text-white tracking-tight mb-4 flex items-baseline gap-1 relative z-10"><span class="text-2xl font-normal opacity-90">₹</span>{{ net().toLocaleString('en-IN') }}</div>
        <div class="grid grid-cols-3 gap-2 pt-3.5 border-t border-white/20 relative z-10">
          <div class="flex flex-col"><span class="text-[11px] text-white/80 leading-tight">Base Commission</span><span class="font-headline-sm text-headline-sm text-white font-bold mt-0.5">{{ inr(commission()) }}</span><span class="text-[10px] text-primary-fixed-dim mt-0.5">{{ me()?.commission }}% cut</span></div>
          <div class="flex flex-col border-l border-white/15 pl-2"><span class="text-[11px] text-white/80 leading-tight">Total Billed</span><span class="font-headline-sm text-headline-sm text-white font-bold mt-0.5">{{ inr(d().revenue) }}</span><span class="text-[10px] text-primary-fixed-dim mt-0.5">GST-inclusive</span></div>
          <div class="flex flex-col border-l border-white/15 pl-2"><span class="text-[11px] text-white/80 leading-tight">Clients Served</span><span class="font-headline-sm text-headline-sm text-white font-bold mt-0.5">{{ d().clients }}</span><span class="text-[10px] text-primary-fixed-dim mt-0.5">this {{ period() }}</span></div>
        </div>
      </div>


      <div class="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant elevation-level-1">
        <p class="text-label-sm font-label-sm text-on-surface-variant mb-3">Your commission rate: <span class="font-bold text-primary">{{ me()?.commission }}%</span> of every completed service.</p>
        <div><button type="button" (click)="statement()" class="w-full py-2 px-3 bg-surface-container-low border border-outline-variant hover:border-primary text-primary rounded-xl text-label-md font-label-md font-semibold text-center transition-all">View Payout Statement</button></div>
      </div>

      <div class="pt-1">
        <div class="flex items-center justify-between mb-2.5"><div class="flex items-center gap-2"><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ 'staff.commissionLog' | translate }}</h2><span class="bg-surface-container-high text-on-surface-variant text-[11px] font-semibold px-2 py-0.5 rounded-full">{{ todayDone().length ? 'Today' : 'Recent' }}</span></div></div>
        <div class="space-y-2.5">
          @for (b of log(); track b.id) {
            <div class="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant elevation-level-1 flex items-center justify-between hover:elevation-level-2 transition-all gap-2">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined text-[22px]">content_cut</span></div>
                <div class="min-w-0"><h3 class="text-body-md font-body-md font-bold text-on-surface truncate">{{ b.client }}</h3><p class="text-body-sm font-body-sm text-on-surface-variant truncate">{{ b.serviceName }}</p><div class="flex items-center gap-2 mt-0.5"><span class="text-[11px] text-outline">Bill: {{ inr(b.price) }}</span></div></div>
              </div>
              <div class="text-right shrink-0"><span class="text-headline-sm font-headline-sm text-primary font-bold block">+{{ inr(cut(b.price)) }}</span><span class="text-[10px] text-outline block">Cut: {{ inr(cut(b.price)) }}</span></div>
            </div>
          } @empty {
            <p class="text-center text-body-sm text-outline py-6">Completed clients will show up here.</p>
          }
        </div>
      </div>
    </main>
  `,
})
export class EarningsPage {
  private readonly store = inject(SalonStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly inr = inr;
  protected readonly initials = initials;
  protected readonly periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'staff.today' }, { key: 'week', label: 'staff.week' }, { key: 'month', label: 'staff.month' },
  ];
  protected readonly period = signal<Period>('week');
  private readonly today = dateKey(new Date());

  protected readonly me = computed(() => this.store.staffById(this.auth.staffId()));
  protected readonly chair = computed(() => this.store.staff().findIndex((s) => s.id === this.auth.staffId()) + 1);
  private readonly stats = computed(() => this.store.stats().find((s) => s.staffId === this.auth.staffId()));
  private readonly pct = computed(() => this.me()?.commission ?? 0);

  protected readonly todayDone = computed(() => this.store.bookingsFor(this.today).filter((b) => b.staffId === this.auth.staffId() && b.status === 'completed'));
  private readonly todayRevenue = computed(() => this.todayDone().reduce((a, b) => a + b.price, 0));

  protected readonly d = computed(() => {
    const st = this.stats();
    const p = this.period();
    const today = { revenue: this.todayRevenue(), clients: this.todayDone().length };
    if (p === 'today' || !st) return today;
    return p === 'week'
      ? { revenue: st.week.reduce((a, b) => a + b, 0) + today.revenue, clients: Math.round(st.clients / 4) + today.clients }
      : { revenue: st.revenue + today.revenue, clients: st.clients + today.clients };
  });
  protected readonly commission = computed(() => Math.round((this.d().revenue * this.pct()) / 100));
  protected readonly net = computed(() => this.commission());
  protected readonly growth = computed(() => {
    const st = this.stats();
    return this.period() === 'today' || !st?.prevRevenue ? null : Math.round(((st.revenue - st.prevRevenue) / st.prevRevenue) * 100);
  });
  protected readonly log = computed(() => {
    const done = this.store.bookings().filter((b) => b.staffId === this.auth.staffId() && b.status === 'completed');
    const today = done.filter((b) => b.date === this.today);
    return (today.length ? today : done).sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start).slice(0, 4);
  });

  cut(price: number) {
    return Math.round((price * this.pct()) / 100);
  }

  statement() {
    const label = this.periods.find((p) => p.key === this.period())!.key;
    downloadText(`payout-${label}-${this.today}.csv`, toCsv([
      ['Payout statement', label], ['Stylist', this.me()?.name ?? ''], ['Revenue', this.d().revenue], ['Commission %', this.pct()],
      ['Commission', this.commission()], ['Net earnings', this.net()],
    ]));
    this.toast.success('Payout statement downloaded');
  }
}
