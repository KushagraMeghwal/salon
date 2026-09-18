import { TranslatePipe } from '@ngx-translate/core';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StaffMember, StaffStats } from '../../../core/models';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { UiService } from '../../../core/services/ui.service';
import { dateKey, downloadText, fmt12, initials, inr, toCsv, LOCALE } from '../../../core/utils/time';
import { Topbar } from '../../../shared/layout/topbar';
import { DayPicker } from '../../../shared/ui/day-picker';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL } from '../../../shared/ui/form-classes';
import { LineChart } from '../../../shared/ui/line-chart';
import { Modal } from '../../../shared/ui/modal';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ROLES = ['Stylist', 'Colorist', 'Esthetician', 'Manager'];

interface Row {
  staff: StaffMember;
  stats: StaffStats;
  commission: number;
  delta: number;
}

@Component({
  selector: 'app-staff-performance',
  imports: [FormsModule, RouterLink, Topbar, Modal, DayPicker, LineChart, TranslatePipe],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-4 flex-1 max-w-xl">
        <div class="relative w-full max-w-xs">
          <span class="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span>
          <input type="text" class="w-full pl-9 pr-4 py-1.5 text-body-sm bg-surface-container-low border border-outline-variant/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface" [placeholder]="'Search staff or skill...' | translate" [attr.aria-label]="'Search staff' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <div class="hidden lg:flex items-center gap-2 bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-1.5">
          <span class="material-symbols-outlined text-primary text-[18px]">calendar_month</span>
          <span class="font-label-md text-label-md text-on-surface font-semibold">{{ "This Month ({{p1}})" | translate: { p1: month() } }}</span>
        </div>
      </div>
      <ng-container right>
        <button type="button" (click)="openAdd()" class="px-3.5 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container font-label-md text-label-md flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all"><span class="material-symbols-outlined text-[18px]">person_add</span><span class="hidden sm:inline">{{ "Add New Staff" | translate }}</span></button>
        <a routerLink="/owner/quick-bill" class="hidden sm:flex px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md items-center gap-1.5 hover:bg-primary-container active:scale-95 transition-all"><span class="material-symbols-outlined text-[18px]">point_of_sale</span><span>{{ "Quick Bill" | translate }}</span></a>
        <button type="button" class="hidden md:block p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors" [title]="'Help' | translate" (click)="toast.info('Select a stylist to see their earnings and adjust commission')"><span class="material-symbols-outlined text-[20px]">help</span></button>
      </ng-container>
    </app-topbar>

    <main class="lg:pl-64 pt-16 min-h-screen bg-background">
      <div class="p-4 md:p-6 flex flex-col gap-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface tracking-tight">{{ "Staff Performance" | translate }}</h2>
            <p class="font-body-md text-body-md text-muted">{{ "Team productivity, commissions and roster load for this month." | translate }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[18px]">group</span></div>
              <div><p class="font-label-sm text-label-sm text-muted">{{ "Active Stylists" | translate }}</p><p class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ "{{p1}} Members" | translate: { p1: (store.staff().length) } }}</p></div>
            </div>
            @if (top(); as t) {
              <div class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
                <div class="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary"><span class="material-symbols-outlined text-[18px]">military_tech</span></div>
                <div><p class="font-label-sm text-label-sm text-muted">{{ "Top Earner" | translate }}</p><p class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ t.staff.name }} <span class="text-primary text-[13px] font-normal">({{ inr(t.stats.revenue) }})</span></p></div>
              </div>
            }
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div class="lg:col-span-7 flex flex-col gap-4">
            <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
              <div class="p-4 flex items-center justify-between gap-2 border-b border-outline-variant/20">
                <div class="flex items-center gap-2"><span class="font-headline-sm text-headline-sm font-bold text-on-surface">{{ "Stylist Roster & Revenue" | translate }}</span><span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">{{ "{{p1}} Active Today" | translate: { p1: (onDuty()) } }}</span></div>
                <button type="button" (click)="exportCsv()" class="px-3 py-1 text-label-sm font-label-sm font-medium rounded-lg border border-outline-variant/40 hover:bg-surface-container transition-colors flex items-center gap-1 text-muted"><span class="material-symbols-outlined text-[16px]">download</span><span>{{ "Export" | translate }}</span></button>
              </div>
              <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr class="bg-surface-container-low/70 border-b border-outline-variant/20 font-label-md text-label-md text-muted uppercase tracking-wider">
                      <th class="py-3 px-4 font-semibold">{{ "Stylist" | translate }}</th><th class="py-3 px-3 font-semibold">{{ "Clients" | translate }}</th><th class="py-3 px-3 font-semibold">{{ "Total Revenue" | translate }}</th><th class="py-3 px-3 font-semibold">{{ "Commission" | translate }}</th><th class="py-3 px-4 font-semibold">{{ "Status" | translate }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-outline-variant/15 text-body-sm">
                    @for (r of rows(); track r.staff.id) {
                      <tr (click)="selectedId.set(r.staff.id)" (keydown.enter)="selectedId.set(r.staff.id)" tabindex="0" class="transition-colors cursor-pointer border-l-4" [class]="selectedId() === r.staff.id ? 'bg-primary/5 hover:bg-primary/10 border-primary' : 'hover:bg-surface-container-low border-transparent'">
                        <td class="py-3.5 px-4">
                          <div class="flex items-center gap-3">
                            @if (r.staff.photo) { <img class="w-9 h-9 rounded-full object-cover" [src]="r.staff.photo" [alt]="r.staff.name" /> }
                            @else { <div class="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-label-md" [class.ring-2]="selectedId() === r.staff.id" [class.ring-primary]="selectedId() === r.staff.id">{{ initials(r.staff.name) }}</div> }
                            <div><p class="font-label-lg text-label-lg font-bold text-on-surface">{{ r.staff.name }}</p><p class="font-label-sm text-label-sm font-medium" [class]="selectedId() === r.staff.id ? 'text-primary' : 'text-muted'">{{ (r.staff.title || r.staff.role) | translate }}</p></div>
                          </div>
                        </td>
                        <td class="py-3.5 px-3"><p class="font-semibold text-on-surface">{{ "{{p1}} clients" | translate: { p1: (r.stats.clients) } }}</p><p class="text-[11px] text-muted">{{ "{{p1}} work days" | translate: { p1: (r.stats.workDays) } }}</p></td>
                        <td class="py-3.5 px-3"><p class="font-bold text-on-surface">{{ inr(r.stats.revenue) }}</p><span class="text-[11px] font-semibold" [class]="r.delta > 0 ? 'text-primary' : 'text-muted'">{{ (r.delta > 0 ? '↑ {{p1}}% vs last month' : r.delta < 0 ? '↓ {{p1}}% vs last month' : '→ steady') | translate: { p1: r.delta < 0 ? -r.delta : r.delta } }}</span></td>
                        <td class="py-3.5 px-3"><p class="font-semibold text-on-surface">{{ inr(r.commission) }}</p><span class="text-[11px] text-muted">{{ "{{p1}}% Tier" | translate: { p1: (r.staff.commission) } }}</span></td>
                        <td class="py-3.5 px-4"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-semibold border whitespace-nowrap" [class]="r.staff.status === 'on-duty' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-muted border-outline-variant/30'"><span class="w-1.5 h-1.5 rounded-full" [class]="r.staff.status === 'on-duty' ? 'bg-emerald-500' : 'bg-outline'"></span>{{ r.staff.status === 'on-duty' ? ('On Duty' | translate) : ('Off' | translate) }}</span></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="py-10 text-center text-outline">{{ "No staff match your search." | translate }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="p-4 bg-surface-container-low/40 border-t border-outline-variant/20 text-body-sm text-muted">{{ "Showing {{p1}} of {{p2}} team members" | translate: { p1: (rows().length), p2: (store.staff().length) } }}</div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm">
                <div class="flex items-center justify-between mb-2"><p class="font-headline-sm text-headline-sm font-bold text-on-surface">{{ "Team Revenue" | translate }}</p><span class="material-symbols-outlined text-primary">payments</span></div>
                <div class="flex items-baseline gap-2 mb-2"><span class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-extrabold text-primary leading-none">{{ inr(totalRevenue()) }}</span></div>
                <p class="text-body-sm text-muted">{{ "Combined billing across {{p1}} team members this month." | translate: { p1: (store.staff().length) } }}</p>
              </div>
              <div class="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm">
                <div class="flex items-center justify-between mb-2"><p class="font-headline-sm text-headline-sm font-bold text-on-surface">{{ "Commission Payable" | translate }}</p><span class="material-symbols-outlined text-secondary">percent</span></div>
                <div class="flex items-baseline gap-2 mb-2"><span class="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-extrabold text-secondary leading-none">{{ inr(totalCommission()) }}</span></div>
                <p class="text-body-sm text-muted">{{ "Payable on the next payout cycle, {{p1}}." | translate: { p1: payoutDate() } }}</p>
              </div>
            </div>
          </div>

          @if (selected(); as r) {
            <div class="lg:col-span-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-md p-5 flex flex-col gap-5">
              <div class="flex items-start justify-between pb-4 border-b border-outline-variant/20 gap-2">
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="relative shrink-0">
                    @if (r.staff.photo) { <img class="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary" [src]="r.staff.photo" [alt]="r.staff.name" /> }
                    @else { <div class="w-16 h-16 rounded-2xl ring-2 ring-primary bg-primary-container text-on-primary-container flex items-center justify-center font-headline-md text-headline-md">{{ initials(r.staff.name) }}</div> }
                    <span class="w-4 h-4 rounded-full border-2 border-surface-container-lowest absolute -bottom-1 -right-1" [class]="r.staff.status === 'on-duty' ? 'bg-emerald-500' : 'bg-outline'"></span>
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2"><h3 class="font-headline-md text-headline-md font-bold text-on-surface truncate">{{ r.staff.name }}</h3>@if (r.staff.id === topId()) { <span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">{{ "Lead" | translate }}</span> }</div>
                    <p class="text-body-sm text-muted truncate">{{ r.staff.phone }}@if (r.staff.email) { • {{ r.staff.email }} }</p>
                    <div class="flex items-center gap-2 mt-1"><span class="font-label-sm text-label-sm bg-surface-container-low px-2 py-0.5 rounded text-on-surface-variant font-medium">{{ (r.staff.role) | translate }}</span><span class="font-label-sm text-label-sm bg-surface-container-low px-2 py-0.5 rounded text-on-surface-variant font-medium">{{ "{{p1}} days/wk" | translate: { p1: (workingDays(r.staff)) } }}</span></div>
                  </div>
                </div>
                <button type="button" class="p-1.5 rounded-lg hover:bg-surface-container text-muted transition-colors" [title]="'Toggle duty status' | translate" (click)="toggleDuty(r.staff)"><span class="material-symbols-outlined text-[20px]">{{ r.staff.status === 'on-duty' ? 'toggle_on' : 'toggle_off' }}</span></button>
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <button type="button" (click)="openCommission(r.staff)" class="py-2 px-3 rounded-xl border border-primary text-primary font-label-md text-label-md font-semibold hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-[18px]">percent</span><span>{{ "Adjust Commission %" | translate }}</span></button>
                <button type="button" (click)="openSchedule(r.staff)" class="py-2 px-3 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"><span class="material-symbols-outlined text-[18px]">calendar_add_on</span><span>{{ "Assign Schedule" | translate }}</span></button>
              </div>

              <div class="p-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/30 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                  <div><p class="font-label-md text-label-md text-muted">{{ "Weekly Earnings Breakdown" | translate }}</p><p class="font-headline-sm text-headline-sm font-bold text-on-surface">{{ "{{p1}} generated" | translate: { p1: (inr(weekTotal())) } }}</p></div>
                  <div class="text-right"><span class="font-label-sm text-label-sm text-muted">{{ "Commission Due" | translate }}</span><p class="font-headline-sm text-headline-sm font-bold text-primary">{{ inr(weekTotal() * r.staff.commission / 100) }}</p></div>
                </div>
                <div class="h-28 w-full pt-2"><app-line-chart [series]="chart()" /></div>
                <div class="flex justify-between text-[11px] text-muted font-medium pt-1">@for (d of week; track d) { <span>{{ d | translate }}</span> }</div>
                <div class="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/20 text-center">
                  <div><span class="text-[11px] text-muted block">{{ "Base Rate" | translate }}</span><span class="font-label-md text-label-md font-bold text-on-surface">{{ "{{p1}}% Flat" | translate: { p1: (r.staff.commission) } }}</span></div>
                  <div><span class="text-[11px] text-muted block">{{ "Clients" | translate }}</span><span class="font-label-md text-label-md font-bold text-on-surface">{{ r.stats.clients }}</span></div>
                  <div><span class="text-[11px] text-muted block">{{ "Billed" | translate }}</span><span class="font-label-md text-label-md font-bold text-primary">{{ inr(r.stats.revenue) }}</span></div>
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <h4 class="font-headline-sm text-headline-sm font-bold text-on-surface">{{ "Bookings Today" | translate }}</h4>
                <div class="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  @for (b of todayBookings(); track b.id) {
                    <div class="p-3 rounded-xl bg-surface-container-low/40 border border-outline-variant/20 flex items-center justify-between gap-2 hover:bg-surface-container-low transition-colors">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-[12px] shrink-0">{{ initials(b.client) }}</div>
                        <div class="min-w-0"><p class="font-label-md text-label-md font-bold text-on-surface truncate">{{ b.client }}</p><p class="text-[11px] text-muted truncate">{{ b.serviceName }} • {{ fmt(b.start) }}</p></div>
                      </div>
                      <div class="text-right shrink-0"><p class="font-label-md text-label-md font-bold text-on-surface">{{ inr(b.price) }}</p><p class="text-[11px] text-emerald-600 font-medium">{{ "Comm: {{p1}}" | translate: { p1: (inr(b.price * r.staff.commission / 100)) } }}</p></div>
                    </div>
                  } @empty {
                    <p class="text-body-sm text-outline py-4 text-center">{{ "No bookings for {{p1}} today." | translate: { p1: (r.staff.name.split(' ')[0]) } }}</p>
                  }
                </div>
              </div>

              <div class="pt-3 border-t border-outline-variant/20 flex items-center justify-between text-label-sm text-muted gap-2">
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-primary">lock_clock</span> {{ "Next payout cycle: {{p1}}" | translate: { p1: payoutDate() } }}</span>
                <button type="button" class="text-primary font-semibold hover:underline" (click)="paySlip(r)">{{ "Download Pay Slip" | translate }}</button>
              </div>
            </div>
          } @else {
            <div class="lg:col-span-5 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/50 p-10 text-center text-muted">
              <span class="material-symbols-outlined text-4xl text-primary/40">badge</span>
              <p class="mt-2 font-label-lg text-label-lg text-on-surface">{{ "Select a stylist" | translate }}</p><p class="text-body-sm">{{ "Pick a row to see earnings, schedule and commission." | translate }}</p>
            </div>
          }
        </div>
      </div>
    </main>

    <app-modal [open]="commissionFor() !== null" [title]="'Adjust Commission %' | translate" (closed)="commissionFor.set(null)">
      @if (commissionFor(); as s) {
        <div class="space-y-4">
          <p class="text-body-md text-muted">{{ "Commission for" | translate }} <strong class="text-on-surface">{{ s.name }}</strong> {{ "on completed services." | translate }}</p>
          <div class="flex items-center gap-4">
            <input type="range" min="0" max="70" class="flex-1 accent-primary" [attr.aria-label]="'Commission percent' | translate" [ngModel]="draftPct()" (ngModelChange)="draftPct.set(+$event)" />
            <div class="flex items-center gap-1 bg-surface-container px-2.5 py-1 rounded-md"><input type="number" min="0" max="100" class="w-12 p-0 text-right bg-transparent border-0 font-bold text-primary focus:ring-0" [attr.aria-label]="'Commission number' | translate" [ngModel]="draftPct()" (ngModelChange)="draftPct.set(+$event)" /><span class="text-primary font-semibold">%</span></div>
          </div>
          <div class="flex justify-end gap-3 pt-4 border-t border-outline-variant/20"><button type="button" [class]="ghost" (click)="commissionFor.set(null)">{{ "Cancel" | translate }}</button><button type="button" [class]="primary" (click)="saveCommission()">{{ "Save" | translate }}</button></div>
        </div>
      }
    </app-modal>

    <app-modal [open]="scheduleFor() !== null" [title]="'Assign Schedule' | translate" (closed)="scheduleFor.set(null)">
      @if (scheduleFor(); as s) {
        <div class="space-y-4">
          <p class="text-body-md text-muted">{{ "Working days for" | translate }} <strong class="text-on-surface">{{ s.name }}</strong>{{ ". Bookings are only accepted on these days." | translate }}</p>
          <app-day-picker [days]="draftDays()" (daysChange)="draftDays.set($event)" />
          <div class="flex justify-end gap-3 pt-4 border-t border-outline-variant/20"><button type="button" [class]="ghost" (click)="scheduleFor.set(null)">{{ "Cancel" | translate }}</button><button type="button" [class]="primary" (click)="saveSchedule()">{{ "Save schedule" | translate }}</button></div>
        </div>
      }
    </app-modal>

    <app-modal [open]="adding()" [title]="'Add New Staff' | translate" (closed)="adding.set(false)">
      <form class="space-y-4" (ngSubmit)="saveNew()" #f="ngForm">
        <div><label [class]="label" for="ns-name">{{ "Full name" | translate }}</label><input id="ns-name" name="name" [class]="input" [(ngModel)]="nName" required [placeholder]="'e.g., Amit Patel' | translate" /></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label [class]="label" for="ns-phone">{{ "Phone" | translate }}</label><input id="ns-phone" name="phone" [class]="input" [(ngModel)]="nPhone" required placeholder="+91 98111 22233" /></div>
          <div><label [class]="label" for="ns-role">{{ "Role" | translate }}</label><select id="ns-role" name="role" [class]="input" [(ngModel)]="nRole">@for (r of roles; track r) { <option [value]="r">{{ r | translate }}</option> }</select></div>
        </div>
        <div><label [class]="label" for="ns-comm">{{ "Commission %" | translate }}</label><input id="ns-comm" name="comm" type="number" min="0" max="100" [class]="input" [(ngModel)]="nComm" required /></div>
        <div class="flex justify-end gap-3 pt-4 border-t border-outline-variant/20"><button type="button" [class]="ghost" (click)="adding.set(false)">{{ "Cancel" | translate }}</button><button type="submit" [class]="primary" [disabled]="f.invalid">{{ "Add staff" | translate }}</button></div>
      </form>
    </app-modal>
  `,
})
export class StaffPerformance {
  protected readonly store = inject(SalonStore);
  protected readonly toast = inject(ToastService);
  protected readonly ui = inject(UiService);
  protected readonly inr = inr;
  protected readonly fmt = fmt12;
  protected readonly initials = initials;
  protected readonly week = WEEK;
  protected readonly roles = ROLES;
  protected readonly input = INPUT;
  protected readonly label = LABEL;
  protected readonly primary = BTN_PRIMARY;
  protected readonly ghost = BTN_GHOST;
  protected readonly month = computed(() => new Date().toLocaleDateString(LOCALE(), { month: 'long', year: 'numeric' }));
  protected readonly payoutDate = computed(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(LOCALE(), { day: '2-digit', month: 'short', year: 'numeric' }));

  protected readonly search = signal('');
  protected readonly selectedId = signal<string | null>(this.store.staff()[0]?.id ?? null);
  protected readonly commissionFor = signal<StaffMember | null>(null);
  protected readonly scheduleFor = signal<StaffMember | null>(null);
  protected readonly draftPct = signal(0);
  protected readonly draftDays = signal<boolean[]>([]);
  protected readonly adding = signal(false);
  protected nName = '';
  protected nPhone = '';
  protected nRole = 'Stylist';
  protected nComm: number | null = 15;

  private readonly all = computed<Row[]>(() =>
    this.store.staff().map((staff) => {
      const stats = this.store.stats().find((s) => s.staffId === staff.id) ?? { staffId: staff.id, clients: 0, workDays: 0, revenue: 0, prevRevenue: 0, week: [0, 0, 0, 0, 0, 0, 0] };
      const delta = stats.prevRevenue ? Math.round(((stats.revenue - stats.prevRevenue) / stats.prevRevenue) * 100) : 0;
      return { staff, stats, commission: Math.round((stats.revenue * staff.commission) / 100), delta };
    }),
  );
  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.all().filter((r) => !q || [r.staff.name, r.staff.role, r.staff.title].some((x) => x.toLowerCase().includes(q))).sort((a, b) => b.stats.revenue - a.stats.revenue);
  });
  protected readonly selected = computed(() => this.all().find((r) => r.staff.id === this.selectedId()) ?? null);
  protected readonly top = computed(() => [...this.all()].sort((a, b) => b.stats.revenue - a.stats.revenue)[0] ?? null);
  protected readonly topId = computed(() => this.top()?.staff.id);
  protected readonly onDuty = computed(() => this.store.staff().filter((s) => s.status === 'on-duty').length);
  protected readonly totalRevenue = computed(() => this.all().reduce((a, r) => a + r.stats.revenue, 0));
  protected readonly totalCommission = computed(() => this.all().reduce((a, r) => a + r.commission, 0));
  protected readonly weekTotal = computed(() => this.selected()?.stats.week.reduce((a, b) => a + b, 0) ?? 0);
  protected readonly chart = computed(() => [{ values: this.selected()?.stats.week ?? [], color: '#00685b', area: true, width: 3, marker: true }]);
  protected readonly todayBookings = computed(() => this.store.bookingsFor(dateKey(new Date())).filter((b) => b.staffId === this.selectedId()).sort((a, b) => a.start - b.start));

  workingDays(s: StaffMember) {
    return s.days.filter(Boolean).length;
  }

  toggleDuty(s: StaffMember) {
    this.store.upsertStaff({ ...s, status: s.status === 'on-duty' ? 'off' : 'on-duty' });
    this.toast.info(s.status === 'on-duty' ? '{{p1}} marked off duty' : '{{p1}} marked on duty', { p1: s.name });
  }

  openCommission(s: StaffMember) {
    this.draftPct.set(s.commission);
    this.commissionFor.set(s);
  }
  saveCommission() {
    const s = this.commissionFor();
    if (!s) return;
    const pct = Math.min(100, Math.max(0, Math.round(this.draftPct() || 0)));
    this.store.upsertStaff({ ...s, commission: pct });
    this.commissionFor.set(null);
    this.toast.success('{{p1}}\'s commission set to {{p2}}%', { p1: s.name, p2: pct });
  }

  openSchedule(s: StaffMember) {
    this.draftDays.set([...s.days]);
    this.scheduleFor.set(s);
  }
  saveSchedule() {
    const s = this.scheduleFor();
    if (!s) return;
    this.store.upsertStaff({ ...s, days: this.draftDays() });
    this.scheduleFor.set(null);
    this.toast.success('{{p1}}\'s schedule updated', { p1: s.name });
  }

  openAdd() {
    this.nName = '';
    this.nPhone = '';
    this.nRole = 'Stylist';
    this.nComm = 15;
    this.adding.set(true);
  }
  saveNew() {
    const m: StaffMember = {
      id: 'st' + Date.now().toString(36), name: this.nName.trim(), role: this.nRole, title: this.nRole, phone: this.nPhone.trim(), email: '',
      serviceIds: this.store.selectedServices().map((s) => s.id), days: [true, true, true, true, true, true, false],
      commission: Math.min(100, Math.max(0, Number(this.nComm) || 0)), photo: null, status: 'on-duty',
    };
    this.store.upsertStaff(m);
    this.selectedId.set(m.id);
    this.adding.set(false);
    this.toast.success('{{p1}} added to your team', { p1: m.name });
  }

  exportCsv() {
    const head = ['Stylist', 'Role', 'Clients', 'Revenue', 'Commission %', 'Commission'];
    const body = this.rows().map((r) => [r.staff.name, r.staff.role, r.stats.clients, r.stats.revenue, r.staff.commission, r.commission]);
    downloadText(`staff-performance-${dateKey(new Date())}.csv`, toCsv([head, ...body]));
    this.toast.success('Staff report exported');
  }

  paySlip(r: Row) {
    downloadText(`payslip-${r.staff.name.replace(/\s+/g, '-').toLowerCase()}-${dateKey(new Date())}.csv`, toCsv([
      ['Pay slip', this.month()], ['Stylist', r.staff.name], ['Role', r.staff.role], ['Revenue', r.stats.revenue],
      ['Commission %', r.staff.commission], ['Commission', r.commission], ['Total payable', r.commission],
    ]));
    this.toast.success('Pay slip downloaded');
  }
}
