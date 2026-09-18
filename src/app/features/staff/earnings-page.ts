import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { dateKey, downloadText, initials, inr, toCsv } from '../../core/utils/time';

type Period = 'today' | 'week' | 'month';
const DAILY_TARGET = 3000;

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
      <div class="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant px-2.5 py-1 rounded-full text-primary shadow-xs shrink-0"><span class="material-symbols-outlined text-[15px]">schedule</span><span class="font-medium text-[11px] whitespace-nowrap">Auto-payout: Daily</span></div>
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
          <div class="flex flex-col border-l border-white/15 pl-2"><span class="text-[11px] text-white/80 leading-tight">Client Tips</span><span class="font-headline-sm text-headline-sm text-white font-bold mt-0.5">{{ inr(d().tips) }}</span><span class="text-[10px] text-primary-fixed-dim mt-0.5">Direct 100%</span></div>
          <div class="flex flex-col border-l border-white/15 pl-2"><span class="text-[11px] text-white/80 leading-tight">Clients Served</span><span class="font-headline-sm text-headline-sm text-white font-bold mt-0.5">{{ d().clients }}</span><span class="text-[10px] text-primary-fixed-dim mt-0.5">{{ inr(d().revenue) }} billed</span></div>
        </div>
      </div>

      <div class="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant elevation-level-1">
        <div class="flex items-center justify-between mb-2"><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[18px]">today</span></div><span class="text-label-md font-label-md font-semibold text-on-surface">Today's Progress</span></div><span class="text-label-sm font-label-sm text-primary font-bold">{{ goalPct() }}% of Goal</span></div>
        <p class="text-body-sm font-body-sm text-on-surface-variant mb-2.5"><strong class="text-on-surface font-semibold text-body-md">{{ inr(todayEarned()) }}</strong> earned from {{ todayDone().length }} completed client{{ todayDone().length === 1 ? '' : 's' }} today</p>
        <div class="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden"><div class="bg-primary h-full rounded-full transition-all duration-300" [style.width.%]="goalPct()"></div></div>
        <div class="flex justify-between items-center mt-1.5 text-label-sm font-label-sm text-outline"><span>{{ inr(todayEarned()) }} earned</span><span>Target: {{ inr(target) }}</span></div>
      </div>

      <div class="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant elevation-level-1">
        <div class="flex items-start justify-between gap-2">
          <div><div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-amber-500 text-[20px]" style="font-variation-settings: 'FILL' 1;">workspace_premium</span><h2 class="text-label-lg font-label-lg font-bold text-on-surface">{{ tier() }} Tier</h2></div><p class="text-label-sm font-label-sm text-on-surface-variant mt-0.5">Current Rate: <span class="font-bold text-primary">{{ me()?.commission }}% Service Commission</span></p></div>
          <span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
        </div>
        <div class="mt-3"><button type="button" (click)="statement()" class="w-full py-2 px-3 bg-surface-container-low border border-outline-variant hover:border-primary text-primary rounded-xl text-label-md font-label-md font-semibold text-center transition-all">View Payout Statement</button></div>
      </div>

      <div class="pt-1">
        <div class="flex items-center justify-between mb-2.5"><div class="flex items-center gap-2"><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ 'staff.commissionLog' | translate }}</h2><span class="bg-surface-container-high text-on-surface-variant text-[11px] font-semibold px-2 py-0.5 rounded-full">{{ todayDone().length ? 'Today' : 'Recent' }}</span></div></div>
        <div class="space-y-2.5">
          @for (b of log(); track b.id) {
            <div class="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant elevation-level-1 flex items-center justify-between hover:elevation-level-2 transition-all gap-2">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined text-[22px]">content_cut</span></div>
                <div class="min-w-0"><h3 class="text-body-md font-body-md font-bold text-on-surface truncate">{{ b.client }}</h3><p class="text-body-sm font-body-sm text-on-surface-variant truncate">{{ b.serviceName }}</p><div class="flex items-center gap-2 mt-0.5"><span class="text-[11px] text-outline">Bill: {{ inr(b.price) }}</span>@if (b.tip) { <span class="text-[10px] bg-tertiary-container/10 text-tertiary font-bold px-1.5 rounded">Tip: {{ inr(b.tip) }}</span> }</div></div>
              </div>
              <div class="text-right shrink-0"><span class="text-headline-sm font-headline-sm text-primary font-bold block">+{{ inr(cut(b.price) + (b.tip ?? 0)) }}</span><span class="text-[10px] text-outline block">Cut: {{ inr(cut(b.price)) }}</span></div>
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
  protected readonly target = DAILY_TARGET;
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
  private readonly todayTips = computed(() => this.todayDone().reduce((a, b) => a + (b.tip ?? 0), 0));

  protected readonly d = computed(() => {
    const st = this.stats();
    const p = this.period();
    if (p === 'today') return { revenue: this.todayRevenue(), tips: this.todayTips(), clients: this.todayDone().length };
    if (!st) return { revenue: this.todayRevenue(), tips: this.todayTips(), clients: this.todayDone().length };
    return p === 'week'
      ? { revenue: st.week.reduce((a, b) => a + b, 0) + this.todayRevenue(), tips: Math.round(st.tips / 4) + this.todayTips(), clients: Math.round(st.clients / 4) + this.todayDone().length }
      : { revenue: st.revenue + this.todayRevenue(), tips: st.tips + this.todayTips(), clients: st.clients + this.todayDone().length };
  });
  protected readonly commission = computed(() => Math.round((this.d().revenue * this.pct()) / 100));
  protected readonly net = computed(() => this.commission() + this.d().tips);
  protected readonly growth = computed(() => {
    const st = this.stats();
    return this.period() === 'today' || !st?.prevRevenue ? null : Math.round(((st.revenue - st.prevRevenue) / st.prevRevenue) * 100);
  });
  protected readonly todayEarned = computed(() => Math.round((this.todayRevenue() * this.pct()) / 100) + this.todayTips());
  protected readonly goalPct = computed(() => Math.min(100, Math.round((this.todayEarned() / DAILY_TARGET) * 100)));
  protected readonly tier = computed(() => (this.pct() >= 20 ? 'Platinum' : this.pct() >= 15 ? 'Gold' : 'Silver'));
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
      ['Commission', this.commission()], ['Tips', this.d().tips], ['Net earnings', this.net()],
    ]));
    this.toast.success('Payout statement downloaded');
  }
}
