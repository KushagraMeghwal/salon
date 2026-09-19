import { TranslatePipe } from '@ngx-translate/core';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomerRecord } from '../../../core/models';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { dateKey, downloadText, initials, inr, toCsv } from '../../../core/utils/time';
import { tr } from '../../../core/utils/i18n';
import { Topbar } from '../../../shared/layout/topbar';

type SortKey = 'lastVisit' | 'visits' | 'totalSpent' | 'name';

@Component({
  selector: 'app-owner-customers',
  imports: [FormsModule, Topbar, TranslatePipe],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-4 flex-1 max-w-xl">
        <div class="relative w-full max-w-sm">
          <span class="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span>
          <input type="text" class="w-full pl-9 pr-4 py-1.5 text-body-sm bg-surface-container-low border border-outline-variant/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface" [placeholder]="'Search by name or phone...' | translate" [attr.aria-label]="'Search customers' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
      </div>
      <ng-container right>
        <button type="button" (click)="exportCsv()" class="px-3.5 py-1.5 rounded-lg border border-outline-variant text-on-surface font-label-md text-label-md flex items-center gap-1.5 hover:bg-surface-container active:scale-95 transition-all"><span class="material-symbols-outlined text-[18px]">download</span><span class="hidden sm:inline">{{ "Export CSV" | translate }}</span></button>
      </ng-container>
    </app-topbar>

    <main class="lg:pl-64 pt-16 min-h-screen bg-background">
      <div class="p-4 md:p-6 flex flex-col gap-6">
        <div>
          <h2 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface tracking-tight">{{ "Customers" | translate }}</h2>
          <p class="font-body-md text-body-md text-muted">{{ "Everyone who has visited your salon, with their visit history." | translate }}</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-level-1 p-4"><p class="font-label-sm text-label-sm text-muted">{{ "Total Customers" | translate }}</p><p class="font-numeric-stat text-numeric-stat text-on-surface font-bold">{{ store.customers().length }}</p></div>
          <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-level-1 p-4"><p class="font-label-sm text-label-sm text-muted">{{ "Returning (2+ visits)" | translate }}</p><p class="font-numeric-stat text-numeric-stat text-on-surface font-bold">{{ returning() }}</p></div>
          <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-level-1 p-4 col-span-2 md:col-span-1"><p class="font-label-sm text-label-sm text-muted">{{ "Flagged for no-shows" | translate }}</p><p class="font-numeric-stat text-numeric-stat text-error font-bold">{{ flagged() }}</p></div>
        </div>

        <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-level-1 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left min-w-[520px]">
              <thead class="bg-surface-container-low text-muted font-label-sm text-label-sm">
                <tr>
                  @for (c of cols; track c.key) {
                    <th class="px-4 py-3 font-semibold" [class.text-right]="c.right">
                      <button type="button" (click)="sortBy(c.key)" class="inline-flex items-center gap-1 hover:text-primary">{{ (c.label) | translate }}@if (sort() === c.key) { <span class="material-symbols-outlined text-[14px]">{{ dir() === 1 ? 'arrow_upward' : 'arrow_downward' }}</span> }</button>
                    </th>
                  }
                  <th class="px-4 py-3 font-semibold text-right">{{ "No-shows" | translate }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/30 font-body-md text-body-md">
                @for (c of rows(); track c.id) {
                  <tr class="hover:bg-surface-container-low/60 transition-colors">
                    <td class="px-4 py-3"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-md text-label-md font-bold shrink-0">{{ initials(c.name) }}</div><div class="min-w-0"><p class="font-semibold text-on-surface truncate">{{ c.name }}</p><p class="font-body-sm text-body-sm text-muted font-mono">{{ c.phone }}</p></div></div></td>
                    <td class="px-4 py-3 text-right font-semibold">{{ c.visits }}</td>
                    <td class="px-4 py-3 text-right font-semibold">{{ inr(c.totalSpent) }}</td>
                    <td class="px-4 py-3 text-on-surface-variant">{{ lastVisit(c) }}</td>
                    <td class="px-4 py-3 text-right">
                      @if (c.noShowCount >= store.settings().noShowThreshold) { <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold"><span class="material-symbols-outlined text-[14px]">flag</span>{{ c.noShowCount }}</span> }
                      @else { <span [class]="c.noShowCount ? 'text-on-surface font-semibold' : 'text-outline'">{{ c.noShowCount }}</span> }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="px-4 py-10 text-center text-outline">{{ "No customers match your search." | translate }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class OwnerCustomers {
  protected readonly store = inject(SalonStore);
  private readonly toast = inject(ToastService);
  protected readonly inr = inr;
  protected readonly initials = initials;
  protected readonly cols: { key: SortKey; label: string; right: boolean }[] = [
    { key: 'name', label: 'Customer', right: false },
    { key: 'visits', label: 'Visits', right: true },
    { key: 'totalSpent', label: 'Total Spent', right: true },
    { key: 'lastVisit', label: 'Last Visit', right: false },
  ];
  protected readonly search = signal('');
  protected readonly sort = signal<SortKey>('lastVisit');
  protected readonly dir = signal<1 | -1>(-1);

  protected readonly returning = computed(() => this.store.customers().filter((c) => c.visits >= 2).length);
  protected readonly flagged = computed(() => this.store.customers().filter((c) => c.noShowCount >= this.store.settings().noShowThreshold).length);
  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    const k = this.sort();
    const d = this.dir();
    return this.store
      .customers()
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (digits.length > 0 && c.phone.replace(/\D/g, '').includes(digits)))
      .sort((a, b) => d * (k === 'name' ? a.name.localeCompare(b.name) : k === 'lastVisit' ? a.lastVisit.localeCompare(b.lastVisit) : a[k] - b[k]));
  });

  sortBy(k: SortKey) {
    if (this.sort() === k) this.dir.update((d) => (d === 1 ? -1 : 1));
    else {
      this.sort.set(k);
      this.dir.set(k === 'name' ? 1 : -1);
    }
  }

  lastVisit(c: CustomerRecord) {
    if (!c.lastVisit) return '—';
    const days = Math.round((Date.parse(dateKey(new Date())) - Date.parse(c.lastVisit)) / 86400000);
    if (days <= 0) return tr('Today');
    if (days === 1) return tr('Yesterday');
    return tr('{{p1}} days ago', { p1: days });
  }

  exportCsv() {
    downloadText('customers.csv', toCsv([['Name', 'Phone', 'Visits', 'Total spent', 'Last visit', 'No-shows'], ...this.rows().map((c) => [c.name, c.phone, c.visits, c.totalSpent, c.lastVisit, c.noShowCount])]));
    this.toast.success('Customer list downloaded');
  }
}
