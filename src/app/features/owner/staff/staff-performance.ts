import { TranslatePipe } from '@ngx-translate/core';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StaffMember, StaffStats } from '../../../core/models';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
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
const DEFAULT_DAYS = [true, true, true, true, true, true, false];

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
        <button type="button" class="hidden md:block p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors" [title]="'Help' | translate" (click)="toast.info('Select a stylist to see their earnings, or edit their profile and services')"><span class="material-symbols-outlined text-[20px]">help</span></button>
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
                <table class="w-full text-left border-collapse min-w-[520px]">
                  <thead>
                    <tr class="bg-surface-container-low/70 border-b border-outline-variant/20 font-label-md text-label-md text-muted uppercase tracking-wider">
                      <th class="py-3 px-4 font-semibold">{{ "Stylist" | translate }}</th><th class="py-3 px-3 font-semibold">{{ "Services" | translate }}</th><th class="py-3 px-3 font-semibold">{{ "Total Revenue" | translate }}</th><th class="py-3 px-3 font-semibold">{{ "Commission" | translate }}</th><th class="py-3 px-4 font-semibold">{{ "Status" | translate }}</th><th class="py-3 px-3 font-semibold"></th>
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
                        <td class="py-3.5 px-3">
                          @if (r.staff.serviceIds.length) {
                            <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-semibold">{{ "{{p1}} services" | translate: { p1: r.staff.serviceIds.length } }}</span>
                          } @else {
                            <span class="px-2 py-0.5 rounded-full bg-error-container/60 text-error font-label-sm text-label-sm font-semibold flex items-center gap-1 w-fit"><span class="material-symbols-outlined text-[14px]">warning</span>{{ "None set" | translate }}</span>
                          }
                        </td>
                        <td class="py-3.5 px-3"><p class="font-bold text-on-surface">{{ inr(r.stats.revenue) }}</p><span class="text-[11px] font-semibold" [class]="r.delta > 0 ? 'text-primary' : 'text-muted'">{{ (r.delta > 0 ? '↑ {{p1}}% vs last month' : r.delta < 0 ? '↓ {{p1}}% vs last month' : '→ steady') | translate: { p1: r.delta < 0 ? -r.delta : r.delta } }}</span></td>
                        <td class="py-3.5 px-3"><p class="font-semibold text-on-surface">{{ inr(r.commission) }}</p><span class="text-[11px] text-muted">{{ "{{p1}}% Tier" | translate: { p1: (r.staff.commission) } }}</span></td>
                        <td class="py-3.5 px-4"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-semibold border whitespace-nowrap" [class]="r.staff.status === 'on-duty' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-muted border-outline-variant/30'"><span class="w-1.5 h-1.5 rounded-full" [class]="r.staff.status === 'on-duty' ? 'bg-emerald-500' : 'bg-outline'"></span>{{ r.staff.status === 'on-duty' ? ('On Duty' | translate) : ('Off' | translate) }}</span></td>
                        <td class="py-3.5 px-3 text-right"><button type="button" (click)="$event.stopPropagation(); edit(r.staff)" class="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/5 transition-colors" [title]="'Edit stylist' | translate"><span class="material-symbols-outlined text-[18px]">edit</span></button></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="6" class="py-10 text-center text-outline">{{ "No staff match your search." | translate }}</td></tr>
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
                    <div class="flex items-center gap-2 mt-1 flex-wrap"><span class="font-label-sm text-label-sm bg-surface-container-low px-2 py-0.5 rounded text-on-surface-variant font-medium">{{ (r.staff.role) | translate }}</span><span class="font-label-sm text-label-sm bg-surface-container-low px-2 py-0.5 rounded text-on-surface-variant font-medium">{{ "{{p1}} days/wk" | translate: { p1: (workingDays(r.staff)) } }}</span></div>
                  </div>
                </div>
                <button type="button" class="p-1.5 rounded-lg hover:bg-surface-container text-muted transition-colors" [title]="'Toggle duty status' | translate" (click)="toggleDuty(r.staff)"><span class="material-symbols-outlined text-[20px]">{{ r.staff.status === 'on-duty' ? 'toggle_on' : 'toggle_off' }}</span></button>
              </div>

              @if (!r.staff.serviceIds.length) {
                <div class="p-3 rounded-xl bg-error-container/30 border border-error/30 flex items-start gap-2 text-error">
                  <span class="material-symbols-outlined text-[18px] mt-0.5">warning</span>
                  <p class="text-body-sm">{{ "No services assigned yet. Customers can never book {{p1}} until you tick at least one service." | translate: { p1: r.staff.name.split(' ')[0] } }}</p>
                </div>
              }

              <div class="grid grid-cols-2 gap-2.5">
                <button type="button" (click)="edit(r.staff)" class="py-2 px-3 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"><span class="material-symbols-outlined text-[18px]">edit</span><span>{{ "Edit Profile & Services" | translate }}</span></button>
                <button type="button" (click)="removeStaff(r.staff)" class="py-2 px-3 rounded-xl border border-error/40 text-error font-label-md text-label-md font-semibold hover:bg-error-container/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-[18px]">person_remove</span><span>{{ "Remove Stylist" | translate }}</span></button>
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

              <div class="flex flex-col gap-2">
                <span class="text-label-sm font-label-sm text-muted uppercase">{{ "Working Days" | translate }}</span>
                <div class="flex gap-1.5">
                  @for (d of r.staff.days; track $index) {
                    <span class="w-7 h-7 rounded-md flex items-center justify-center text-label-sm font-label-sm" [class]="d ? 'bg-primary text-on-primary font-semibold' : 'bg-surface-container text-muted opacity-40'">{{ week[$index].charAt(0) }}</span>
                  }
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-label-sm font-label-sm text-muted uppercase">{{ "Services Performed" | translate }}</span>
                <div class="flex flex-wrap gap-1.5">
                  @for (n of serviceNames(r.staff); track n) {
                    <span class="px-2.5 py-1 rounded-md text-label-sm font-label-sm bg-surface-container text-on-surface">{{ n }}</span>
                  } @empty {
                    <span class="text-body-sm text-error">{{ "None yet — tap Edit Profile & Services to fix." | translate }}</span>
                  }
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

    <app-modal [open]="showEditor()" [title]="editingId() ? ('Edit Stylist' | translate) : ('Add New Staff' | translate)" [wide]="true" (closed)="closeEditor()">
      <form class="space-y-5" (submit)="$event.preventDefault(); saveEditor()" novalidate>
        <div class="flex items-center gap-4">
          <label class="relative w-16 h-16 rounded-full border-2 border-dashed border-outline-variant flex flex-col items-center justify-center bg-surface-container-low text-muted hover:border-primary cursor-pointer transition-colors group overflow-hidden shrink-0">
            <input type="file" class="sr-only" accept="image/png,image/jpeg" (change)="onPhoto($any($event.target).files?.[0])" />
            @if (ePhoto()) {
              <img [src]="ePhoto()" [alt]="'Staff photo preview' | translate" class="absolute inset-0 w-full h-full object-cover" />
            } @else {
              <span class="material-symbols-outlined text-[22px] group-hover:text-primary transition-colors">add_a_photo</span>
              <span class="text-[9px] font-medium mt-0.5 text-outline">{{ "Upload" | translate }}</span>
            }
            @if (ePhotoUploading()) {
              <div class="absolute inset-0 bg-surface/70 flex items-center justify-center"><span class="material-symbols-outlined animate-spin text-primary text-lg">progress_activity</span></div>
            }
          </label>
          <div>
            <p class="text-label-md font-label-md text-on-surface">{{ "Staff Profile Photo" | translate }}</p>
            <p class="text-body-sm font-body-sm text-muted">{{ "PNG, JPG up to 5MB." | translate }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label [class]="label" for="es-name">{{ "Full Name" | translate }}</label>
            <input id="es-name" [class]="input" [ngModel]="eName()" (ngModelChange)="eName.set($event)" name="ename" [placeholder]="'e.g., Amit Patel' | translate" />
            @if (submitted() && !eName().trim()) { <p class="text-body-sm text-error mt-1">{{ "Name is required." | translate }}</p> }
          </div>
          <div>
            <label [class]="label" for="es-phone">{{ "Phone Number" | translate }}</label>
            <input id="es-phone" [class]="input" [ngModel]="ePhone()" (ngModelChange)="ePhone.set($event)" name="ephone" placeholder="+91 98111 22233" />
            @if (submitted() && !ePhoneOk()) { <p class="text-body-sm text-error mt-1">{{ "Enter a valid 10-digit mobile number." | translate }}</p> }
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label [class]="label" for="es-email">{{ "Email (optional)" | translate }}</label>
            <input id="es-email" type="email" [class]="input" [ngModel]="eEmail()" (ngModelChange)="eEmail.set($event)" name="eemail" placeholder="amit@example.com" />
          </div>
          <div>
            <label [class]="label" for="es-role">{{ "Role / Designation" | translate }}</label>
            <select id="es-role" [class]="input" [ngModel]="eRole()" (ngModelChange)="eRole.set($event)" name="erole">
              @for (r of roles; track r) { <option [value]="r">{{ r | translate }}</option> }
            </select>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-label-md font-label-md text-on-surface">{{ "Services Performed" | translate }}</span>
            <button type="button" class="text-label-sm font-label-sm text-primary hover:underline" (click)="toggleAllServices()">{{ eAllSelected() ? ('Clear All' | translate) : ('Select All' | translate) }}</button>
          </div>
          <div class="flex flex-wrap gap-2 pt-1">
            @for (s of store.selectedServices(); track s.id) {
              <button type="button" (click)="toggleService(s.id)" [attr.aria-pressed]="eServiceIds().includes(s.id)" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-label-sm border cursor-pointer transition-colors" [class]="eServiceIds().includes(s.id) ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/50 text-muted hover:border-primary'">
                @if (eServiceIds().includes(s.id)) { <span class="material-symbols-outlined text-[14px]">check</span> }
                <span>{{ s.name }}</span>
              </button>
            } @empty {
              <span class="text-body-sm text-muted">{{ "Add services in Settings first." | translate }}</span>
            }
          </div>
          @if (submitted() && !eServiceIds().length) { <p class="text-body-sm text-error mt-1">{{ "Assign at least one service, or customers can never book this stylist." | translate }}</p> }
        </div>

        <div>
          <span class="block text-label-md font-label-md text-on-surface mb-1.5">{{ "Working Days" | translate }}</span>
          <app-day-picker [days]="eDays()" (daysChange)="eDays.set($event)" />
          @if (submitted() && !eDays().some(d => d)) { <p class="text-body-sm text-error mt-1">{{ "Pick at least one working day." | translate }}</p> }
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-label-md font-label-md text-on-surface" for="es-commission">{{ "Commission on Services" | translate }}</label>
            <div class="flex items-center gap-1 bg-surface-container px-2.5 py-1 rounded-md">
              <input type="number" min="0" max="100" name="ecommission-num" [attr.aria-label]="'Commission percent' | translate" class="w-10 p-0 text-right bg-transparent border-0 font-bold text-primary focus:ring-0 text-label-md" [ngModel]="eCommission()" (ngModelChange)="setCommission($event)" />
              <span class="text-label-sm font-label-sm text-primary">%</span>
            </div>
          </div>
          <input id="es-commission" type="range" min="0" max="70" class="w-full accent-primary h-2 bg-surface-container-high rounded-lg cursor-pointer" [value]="eCommission()" (input)="setCommission($any($event.target).value)" />
        </div>

        <div class="flex justify-between items-center gap-3 pt-4 border-t border-outline-variant/20">
          @if (editingId()) {
            <button type="button" class="text-error font-label-md text-label-md font-semibold hover:underline flex items-center gap-1" (click)="removeFromEditor()"><span class="material-symbols-outlined text-[18px]">person_remove</span>{{ "Remove stylist" | translate }}</button>
          } @else { <span></span> }
          <div class="flex gap-3">
            <button type="button" [class]="ghost" (click)="closeEditor()">{{ "Cancel" | translate }}</button>
            <button type="submit" [class]="primary">{{ editingId() ? ('Save Changes' | translate) : ('Add Staff' | translate) }}</button>
          </div>
        </div>
      </form>
    </app-modal>
  `,
})
export class StaffPerformance {
  protected readonly store = inject(SalonStore);
  private readonly analytics = inject(AnalyticsService);
  protected readonly toast = inject(ToastService);
  protected readonly ui = inject(UiService);
  private readonly cloudinary = inject(CloudinaryService);
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

  private readonly route = inject(ActivatedRoute);
  protected readonly search = signal('');
  protected readonly selectedId = signal<string | null>(this.store.staff()[0]?.id ?? null);

  // ---- editor (add + edit share one form) ----
  protected readonly showEditor = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly eName = signal('');
  protected readonly ePhone = signal('');
  protected readonly eEmail = signal('');
  protected readonly eRole = signal('Stylist');
  protected readonly eServiceIds = signal<string[]>([]);
  protected readonly eDays = signal<boolean[]>([...DEFAULT_DAYS]);
  protected readonly eCommission = signal(20);
  protected readonly ePhoto = signal<string | null>(null);
  protected readonly ePhotoUploading = signal(false);

  protected readonly ePhoneOk = computed(() => this.ePhone().replace(/\D/g, '').length >= 10);
  protected readonly eAllSelected = computed(() => {
    const all = this.store.selectedServices();
    return all.length > 0 && all.every((s) => this.eServiceIds().includes(s.id));
  });

  constructor() {
    // Deep link from the setup-health nudge (`/owner/staff;edit=<id>`): open that stylist's editor right away.
    const editId = this.route.snapshot.paramMap.get('edit');
    const m = editId ? this.store.staffById(editId) : undefined;
    if (m) {
      this.selectedId.set(m.id);
      this.edit(m);
    }
  }

  private readonly all = computed<Row[]>(() =>
    this.store.staff().map((staff) => {
      const stats = this.analytics.staffStats().find((s) => s.staffId === staff.id) ?? { staffId: staff.id, clients: 0, workDays: 0, revenue: 0, prevRevenue: 0, week: [0, 0, 0, 0, 0, 0, 0] };
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

  serviceNames(m: StaffMember) {
    return m.serviceIds.map((id) => this.store.serviceById(id)).filter((s) => s?.selected).map((s) => s!.name);
  }

  toggleDuty(s: StaffMember) {
    this.store.upsertStaff({ ...s, status: s.status === 'on-duty' ? 'off' : 'on-duty' });
    this.toast.info(s.status === 'on-duty' ? '{{p1}} marked off duty' : '{{p1}} marked on duty', { p1: s.name });
  }

  // ---- editor actions ----
  openAdd() {
    this.editingId.set(null);
    this.eName.set('');
    this.ePhone.set('');
    this.eEmail.set('');
    this.eRole.set('Stylist');
    this.eServiceIds.set(this.store.selectedServices().map((s) => s.id));
    this.eDays.set([...DEFAULT_DAYS]);
    this.eCommission.set(20);
    this.ePhoto.set(null);
    this.ePhotoUploading.set(false);
    this.submitted.set(false);
    this.showEditor.set(true);
  }

  edit(s: StaffMember) {
    this.editingId.set(s.id);
    this.eName.set(s.name);
    this.ePhone.set(s.phone);
    this.eEmail.set(s.email ?? '');
    this.eRole.set(this.roles.includes(s.role) ? s.role : 'Stylist');
    this.eServiceIds.set([...s.serviceIds]);
    this.eDays.set([...s.days]);
    this.eCommission.set(s.commission);
    this.ePhoto.set(s.photo);
    this.ePhotoUploading.set(false);
    this.submitted.set(false);
    this.showEditor.set(true);
  }

  closeEditor() {
    this.showEditor.set(false);
  }

  toggleService(id: string) {
    this.eServiceIds.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  toggleAllServices() {
    this.eServiceIds.set(this.eAllSelected() ? [] : this.store.selectedServices().map((s) => s.id));
  }

  setCommission(v: number | string) {
    this.eCommission.set(Math.min(100, Math.max(0, Math.round(Number(v) || 0))));
  }

  onPhoto(file: File | undefined | null) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return this.toast.error('Photo must be a PNG or JPG image.');
    if (file.size > 5 * 1024 * 1024) return this.toast.error('Photo must be 5MB or smaller.');
    const reader = new FileReader();
    reader.onload = () => this.ePhoto.set(reader.result as string);
    reader.readAsDataURL(file);

    this.ePhotoUploading.set(true);
    this.cloudinary
      .uploadImage(file)
      .then((url) => this.ePhoto.set(url))
      .catch(() => this.toast.error('Could not upload the photo. The preview is local only until you retry.'))
      .finally(() => this.ePhotoUploading.set(false));
  }

  saveEditor() {
    this.submitted.set(true);
    if (!this.eName().trim() || !this.ePhoneOk() || !this.eServiceIds().length || !this.eDays().some(Boolean)) return;
    const existing = this.store.staffById(this.editingId());
    const m: StaffMember = {
      id: existing?.id ?? 'st' + Date.now().toString(36),
      name: this.eName().trim(),
      role: this.eRole(),
      title: existing && existing.role === this.eRole() ? existing.title : this.eRole(),
      phone: this.ePhone().trim(),
      email: this.eEmail().trim(),
      serviceIds: this.eServiceIds(),
      days: this.eDays(),
      commission: this.eCommission(),
      photo: this.ePhoto(),
      status: existing?.status ?? 'on-duty',
    };
    this.store.upsertStaff(m);
    this.selectedId.set(m.id);
    this.showEditor.set(false);
    this.toast.success(existing ? '{{p1}} updated' : '{{p1}} added to your team', { p1: m.name });
  }

  removeStaff(s: StaffMember) {
    this.store.removeStaff(s.id);
    if (this.selectedId() === s.id) this.selectedId.set(this.store.staff()[0]?.id ?? null);
    this.toast.info('{{p1}} removed', { p1: s.name });
  }

  removeFromEditor() {
    const id = this.editingId();
    if (!id) return;
    const s = this.store.staffById(id);
    this.store.removeStaff(id);
    this.showEditor.set(false);
    if (this.selectedId() === id) this.selectedId.set(this.store.staff()[0]?.id ?? null);
    if (s) this.toast.info('{{p1}} removed', { p1: s.name });
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
