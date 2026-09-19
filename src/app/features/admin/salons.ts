import { TranslatePipe } from '@ngx-translate/core';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminSalon, SubscriptionStatus } from '../../core/models';
import { AdminStore } from '../../core/services/admin.store';
import { ToastService } from '../../core/services/toast.service';
import { inr } from '../../core/utils/time';
import { Modal } from '../../shared/ui/modal';

const BADGE: Record<SubscriptionStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trial: 'bg-amber-50 text-amber-800 border-amber-200',
  suspended: 'bg-error-container text-on-error-container border-error/20',
  expired: 'bg-gray-100 text-muted border-outline-variant/30',
};

@Component({
  selector: 'app-admin-salons',
  imports: [FormsModule, Modal, TranslatePipe],
  template: `
    <div class="p-4 md:p-8 flex flex-col gap-6 max-w-[1400px] mx-auto">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div><h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">{{ "Salons" | translate }}</h1><p class="font-body-md text-body-md text-outline">{{ "Plan, trial end date and status for every salon on the platform." | translate }}</p></div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="relative w-64 max-w-full"><span class="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span><input type="text" class="w-full pl-9 pr-3 py-2 text-body-sm bg-surface-container-lowest border border-outline-variant/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" [placeholder]="'Search salon, owner or city' | translate" [attr.aria-label]="'Search salons' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" /></div>
          <div class="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 overflow-x-auto no-scrollbar">
            @for (f of filters; track f) { <button type="button" (click)="status.set(f)" class="px-3 py-1 rounded-lg font-label-sm text-label-sm capitalize whitespace-nowrap transition-colors" [class]="status() === f ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs' : 'text-outline hover:text-on-surface font-medium'">{{ f | translate }}</button> }
          </div>
        </div>
      </div>

      <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-left border-collapse min-w-[760px]">
            <thead><tr class="bg-surface-container-low/70 border-b border-outline-variant/20 font-label-md text-label-md text-muted uppercase tracking-wider"><th class="py-3 px-4 font-semibold">{{ "Salon" | translate }}</th><th class="py-3 px-3 font-semibold">{{ "Plan" | translate }}</th><th class="py-3 px-3 font-semibold">{{ "Trial ends" | translate }}</th><th class="py-3 px-3 font-semibold">{{ "Status" | translate }}</th><th class="py-3 px-4 font-semibold text-right">{{ "Actions" | translate }}</th></tr></thead>
            <tbody class="divide-y divide-outline-variant/15 text-body-sm">
              @for (s of list(); track s.id) {
                <tr class="hover:bg-surface-container-low transition-colors">
                  <td class="py-3.5 px-4"><p class="font-label-lg text-label-lg font-bold text-on-surface">{{ s.name }}</p><p class="text-[11px] text-muted">{{ s.owner }} • {{ s.city }}</p></td>
                  <td class="py-3.5 px-3 font-semibold text-on-surface">{{ s.plan | translate }}</td>
                  <td class="py-3.5 px-3"><p class="text-on-surface">{{ s.trialEndsAt }}</p>@if (s.status === 'trial') { <span class="text-[11px] text-amber-700 font-medium">{{ "{{p1}} days left" | translate: { p1: (store.daysLeft(s.trialEndsAt)) } }}</span> }</td>
                  <td class="py-3.5 px-3"><span class="inline-flex items-center px-2.5 py-1 rounded-full text-label-sm font-semibold border capitalize" [class]="badge[s.status]">{{ s.status | translate }}</span></td>
                  <td class="py-3.5 px-4"><div class="flex items-center justify-end gap-2">
                    <button type="button" class="px-3 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface hover:bg-surface-container font-label-md text-label-md" (click)="view.set(s)">{{ "View" | translate }}</button>
                    @if (s.status === 'suspended') { <button type="button" class="px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/5 font-label-md text-label-md" (click)="reactivate(s)">{{ "Reactivate" | translate }}</button> }
                    @else { <button type="button" class="px-3 py-1.5 rounded-lg border border-error/40 text-error hover:bg-error-container/30 font-label-md text-label-md" (click)="suspend(s)">{{ "Suspend" | translate }}</button> }
                  </div></td>
                </tr>
              } @empty { <tr><td colspan="5" class="py-12 text-center text-outline">{{ "No salons match these filters." | translate }}</td></tr> }
            </tbody>
          </table>
        </div>
        <div class="p-4 bg-surface-container-low/40 border-t border-outline-variant/20 text-body-sm text-muted">{{ "Showing {{p1}} of {{p2}} salons" | translate: { p1: (list().length), p2: (store.rows().length) } }}</div>
      </div>
    </div>

    <app-modal [open]="view() !== null" [title]="'Salon details' | translate" (closed)="view.set(null)">
      @if (view(); as v) {
        <div class="space-y-4">
          <div><h4 class="font-headline-md text-headline-md text-on-surface">{{ v.name }}</h4><p class="text-body-sm text-outline">{{ v.owner }} • {{ v.city }}</p></div>
          <dl class="grid grid-cols-2 gap-3 text-body-md">
            <div><dt class="text-label-sm text-outline">{{ "Plan" | translate }}</dt><dd class="font-semibold">{{ v.plan }}</dd></div>
            <div><dt class="text-label-sm text-outline">{{ "Status" | translate }}</dt><dd class="font-semibold capitalize">{{ v.status }}</dd></div>
            <div><dt class="text-label-sm text-outline">{{ "Joined" | translate }}</dt><dd class="font-semibold">{{ v.joinedAt }}</dd></div>
            <div><dt class="text-label-sm text-outline">{{ "Trial ends" | translate }}</dt><dd class="font-semibold">{{ v.trialEndsAt }}</dd></div>
            <div><dt class="text-label-sm text-outline">{{ "Team size" | translate }}</dt><dd class="font-semibold">{{ "{{p1}} staff" | translate: { p1: (v.staff) } }}</dd></div>
            <div><dt class="text-label-sm text-outline">MRR</dt><dd class="font-semibold">{{ inr(v.mrr) }}</dd></div>
          </dl>
          <div class="flex flex-wrap justify-end gap-2 pt-4 border-t border-outline-variant/20">
            <button type="button" class="px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary/5 font-label-md text-label-md" (click)="extend(v)">{{ "Extend trial +7 days" | translate }}</button>
            <button type="button" class="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold" (click)="view.set(null)">{{ "Close" | translate }}</button>
          </div>
        </div>
      }
    </app-modal>
  `,
})
export class AdminSalons implements OnInit {
  protected readonly store = inject(AdminStore);
  private readonly toast = inject(ToastService);
  protected readonly inr = inr;
  protected readonly badge = BADGE;
  protected readonly filters = ['all', 'trial', 'active', 'suspended', 'expired'];
  protected readonly search = signal('');
  protected readonly status = signal('all');
  protected readonly view = signal<(AdminSalon & { mrr: number }) | null>(null);

  ngOnInit() {
    void this.store.load();
  }

  protected readonly list = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.store.rows().filter((s) => (this.status() === 'all' || s.status === this.status()) && (!q || [s.name, s.owner, s.city].some((x) => x.toLowerCase().includes(q))));
  });

  async suspend(s: AdminSalon) {
    const err = await this.store.suspend(s.id);
    if (err) return this.toast.error(err);
    this.toast.info('{{p1}} suspended', { p1: s.name });
  }
  async reactivate(s: AdminSalon) {
    const err = await this.store.reactivate(s.id);
    if (err) return this.toast.error(err);
    this.toast.success('{{p1}} reactivated', { p1: s.name });
  }
  async extend(s: AdminSalon) {
    const err = await this.store.extendTrial(s.id, 7);
    if (err) return this.toast.error(err);
    this.view.set(this.store.rows().find((x) => x.id === s.id) ?? null);
    this.toast.success('Trial extended by 7 days');
  }
}
