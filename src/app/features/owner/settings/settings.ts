import { TranslatePipe } from '@ngx-translate/core';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { BreakSettings, DayTiming, Holiday, SalonSettings } from '../../../core/models';
import { AdminStore } from '../../../core/services/admin.store';
import { AuthService, authMessage } from '../../../core/services/auth.service';
import { LangService } from '../../../core/services/lang.service';
import { PaymentConnectService } from '../../../core/services/payment-connect.service';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { GSTIN_PATTERN } from '../../../core/utils/gst';
import { tr } from '../../../core/utils/i18n';
import { dateKey, inr, toMin, LOCALE } from '../../../core/utils/time';
import { Topbar } from '../../../shared/layout/topbar';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL } from '../../../shared/ui/form-classes';
import { Modal } from '../../../shared/ui/modal';
import { Toggle } from '../../../shared/ui/toggle';

type Tab = 'general' | 'hours' | 'policies' | 'payments' | 'subscription' | 'account';
interface Draft { settings: SalonSettings; brk: BreakSettings; buffer: number; timings: DayTiming[] }

const TABS: { key: Tab; label: string; hint: string; icon: string }[] = [
  { key: 'general', label: 'General', hint: 'Booking link, language, GST', icon: 'tune' },
  { key: 'hours', label: 'Business hours', hint: 'Opening hours, breaks, holidays', icon: 'schedule' },
  { key: 'policies', label: 'Booking policies', hint: 'Cancellations & no-shows', icon: 'gavel' },
  { key: 'payments', label: 'Payments', hint: 'Razorpay & UPI', icon: 'account_balance' },
  { key: 'subscription', label: 'Subscription', hint: 'Plan & trial', icon: 'workspace_premium' },
  { key: 'account', label: 'Account & security', hint: 'Login, password, sign out', icon: 'shield_person' },
];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SELECT = 'w-full h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-on-surface font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary';
const TIME = 'w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-on-surface font-body-md text-body-md text-center focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40';
const CARD = 'bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 md:p-6 nordic-shadow';
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,32}$/;

@Component({
  selector: 'app-owner-settings',
  imports: [FormsModule, RouterLink, Topbar, Modal, Toggle, TranslatePipe],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-2"><span class="material-symbols-outlined text-primary">settings</span><span class="font-headline-sm text-headline-sm text-on-surface">{{ "Settings" | translate }}</span></div>
      <ng-container right>
        @if (store.lastSaved(); as t) { <span class="hidden md:inline font-label-sm text-label-sm text-outline">{{ 'Last saved {{p1}}' | translate: { p1: savedAt(t) } }}</span> }
      </ng-container>
    </app-topbar>

    <main class="lg:pl-64 pt-16 min-h-screen bg-background">
      <div class="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto" [class.pb-28]="dirty()">
        <div class="mb-5">
          <h1 class="text-headline-lg-mobile md:text-headline-lg font-headline-lg text-on-surface tracking-tight">{{ "Settings" | translate }}</h1>
          <p class="font-body-md text-body-md text-on-surface-variant">{{ "Configure how your salon takes bookings, payments and invoices." | translate }}</p>
        </div>

        <div class="flex flex-col lg:flex-row gap-6">
          <!-- Section navigation: chips on mobile, side list on desktop -->
          <nav class="lg:w-64 shrink-0" [attr.aria-label]="'Settings sections' | translate">
            <div class="flex lg:flex-col gap-2 lg:gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:sticky lg:top-24" role="tablist">
              @for (t of tabs; track t.key) {
                <button type="button" role="tab" [attr.aria-selected]="tab() === t.key" (click)="tab.set(t.key)"
                  class="shrink-0 flex items-center gap-3 px-3.5 py-2 lg:py-2.5 rounded-xl text-left transition-colors"
                  [class]="tab() === t.key ? 'bg-primary text-on-primary lg:bg-primary/10 lg:text-primary shadow-sm lg:shadow-none' : 'bg-surface-container-lowest lg:bg-transparent border border-outline-variant/40 lg:border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'">
                  <span class="material-symbols-outlined text-[20px]">{{ t.icon }}</span>
                  <span class="flex flex-col min-w-0">
                    <span class="font-label-lg text-label-lg whitespace-nowrap" [class.font-semibold]="tab() === t.key">{{ t.label | translate }}</span>
                    <span class="hidden lg:block font-body-sm text-[12px] opacity-80 truncate">{{ t.hint | translate }}</span>
                  </span>
                  @if (tabHasError(t.key)) { <span class="w-2 h-2 rounded-full bg-error ml-auto shrink-0" [attr.aria-label]="'Needs attention' | translate"></span> }
                </button>
              }
            </div>
          </nav>

          <div class="flex-1 min-w-0 space-y-6">
            <!-- ============ GENERAL ============ -->
            @if (tab() === 'general') {
              @if (store.profile().slug) {
                <section [class]="card">
                  <div class="flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-primary">link</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Your booking link" | translate }}</h2>
                    <span class="ml-auto inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm" [class]="store.bookable() ? 'bg-tertiary/10 text-tertiary' : 'bg-error/10 text-error'"><span class="w-1.5 h-1.5 rounded-full" [class]="store.bookable() ? 'bg-tertiary' : 'bg-error'"></span>{{ (store.bookable() ? 'Taking bookings' : 'Online booking is off') | translate }}</span>
                  </div>
                  <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">{{ "Share it on WhatsApp, Instagram or Google so customers can book 24×7." | translate }}</p>
                  <div class="flex flex-col sm:flex-row gap-2">
                    <div class="flex-1 min-w-0 flex items-center h-11 px-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 font-mono text-body-sm text-on-surface"><span class="truncate">{{ bookingLink() }}</span></div>
                    <div class="flex gap-2">
                      <button type="button" (click)="copyLink()" class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold"><span class="material-symbols-outlined text-[18px]">content_copy</span>{{ "Copy" | translate }}</button>
                      @if (canShare) { <button type="button" (click)="shareLink()" class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl border border-outline-variant font-label-md text-label-md hover:bg-surface-container-low"><span class="material-symbols-outlined text-[18px]">ios_share</span>{{ "Share" | translate }}</button> }
                      <a routerLink="/owner/qr" class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl border border-outline-variant font-label-md text-label-md hover:bg-surface-container-low"><span class="material-symbols-outlined text-[18px]">qr_code_2</span>{{ "QR" | translate }}</a>
                    </div>
                  </div>
                </section>
              }

              <section [class]="card">
                <div class="flex items-center gap-2 mb-4"><span class="material-symbols-outlined text-[22px] text-primary">translate</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Language & region" | translate }}</h2></div>
                <div class="divide-y divide-outline-variant/30">
                  <div class="flex items-center justify-between gap-4 py-3">
                    <div><p class="font-label-lg text-label-lg text-on-surface">{{ "Hindi Dual-Support" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "हिन्दी toggle for customers & staff" | translate }}</p></div>
                    <app-toggle [checked]="draft().settings.hindiSupport" (checkedChange)="patch({ hindiSupport: $event })" [label]="'Hindi support' | translate" />
                  </div>
                  <div class="flex items-center justify-between gap-4 py-3">
                    <div><p class="font-label-lg text-label-lg text-on-surface">{{ "Currency" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "All prices include GST" | translate }}</p></div>
                    <span class="font-label-md text-label-md text-on-surface">{{ "INR (₹) - Indian Rupee" | translate }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-4 py-3">
                    <div><p class="font-label-lg text-label-lg text-on-surface">{{ "Time zone" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Used for slots, reminders and reports" | translate }}</p></div>
                    <span class="font-label-md text-label-md text-on-surface">{{ "Asia/Kolkata (IST)" | translate }}</span>
                  </div>
                </div>
                <div class="pt-3 mt-1 border-t border-outline-variant/20 flex justify-end"><button type="button" (click)="previewHindi()" class="text-primary font-label-md text-label-md hover:underline">{{ "Preview in Hindi" | translate }}</button></div>
              </section>

              <section [class]="card">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined">receipt_long</span></div>
                    <div>
                      <h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "GST & Invoicing" | translate }}</h2>
                      <p class="font-body-sm text-body-sm text-on-surface-variant">{{ (draft().settings.gstRegistered ? "Prices are always GST-inclusive. Bills show the tax breakdown inside the price." : "Prices are always GST-inclusive. No GST is added or shown on bills.") | translate }}</p>
                    </div>
                  </div>
                  <app-toggle [checked]="draft().settings.gstRegistered" (checkedChange)="patch({ gstRegistered: $event })" [label]="'GST registered' | translate" />
                </div>
                @if (draft().settings.gstRegistered) {
                  <div class="mt-4 pt-4 border-t border-outline-variant/20 max-w-md">
                    <label [class]="label" for="gstin">{{ "GSTIN" | translate }}</label>
                    <input id="gstin" type="text" maxlength="15" autocomplete="off" [class]="input + ' uppercase font-mono tracking-wider'" [class.border-error]="!gstinOk()" [placeholder]="'29ABCDE1234F1Z5' | translate" [ngModel]="draft().settings.gstin" (ngModelChange)="patch({ gstin: ($event || '').toUpperCase().trim() })" />
                    <p class="text-body-sm mt-1" [class]="gstinOk() ? 'text-outline' : 'text-error'">{{ gstinOk() ? ('Printed on every bill. GST rate: 18% (CGST 9% + SGST 9%).' | translate) : ('Enter a valid 15-character GSTIN, e.g. 29ABCDE1234F1Z5.' | translate) }}</p>
                  </div>
                }
              </section>
            }

            <!-- ============ BUSINESS HOURS ============ -->
            @if (tab() === 'hours') {
              <section [class]="card">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-1">
                  <div class="flex items-center gap-2"><span class="material-symbols-outlined text-primary">storefront</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Opening hours" | translate }}</h2></div>
                  <button type="button" (click)="copyMonday()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant font-label-md text-label-md hover:bg-surface-container-low"><span class="material-symbols-outlined text-[16px]">content_copy</span>{{ "Copy Monday to all days" | translate }}</button>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">{{ "Customers can only book inside these hours." | translate }}</p>
                <div class="divide-y divide-outline-variant/30">
                  @for (t of draft().timings; track $index; let i = $index) {
                    <div class="py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[150px_auto_1fr] items-center gap-x-4 gap-y-2">
                      <span class="font-label-lg text-label-lg text-on-surface">{{ days[i] | translate }}</span>
                      <div class="flex items-center gap-2 justify-self-end sm:justify-self-start">
                        <app-toggle [checked]="t.open" (checkedChange)="patchDay(i, { open: $event })" [label]="days[i] | translate" />
                        <span class="font-label-md text-label-md w-14" [class]="t.open ? 'text-primary' : 'text-outline'">{{ (t.open ? 'Open' : 'Closed') | translate }}</span>
                      </div>
                      @if (t.open) {
                        <div class="col-span-2 sm:col-span-1 flex items-center gap-2 max-w-sm">
                          <input type="time" [class]="time" [attr.aria-label]="('Opens' | translate) + ' ' + (days[i] | translate)" [ngModel]="t.start" (ngModelChange)="patchDay(i, { start: $event })" />
                          <span class="text-outline">–</span>
                          <input type="time" [class]="time" [class.border-error]="!dayOk(t)" [attr.aria-label]="('Closes' | translate) + ' ' + (days[i] | translate)" [ngModel]="t.end" (ngModelChange)="patchDay(i, { end: $event })" />
                        </div>
                        @if (!dayOk(t)) { <p class="col-span-2 sm:col-start-3 text-body-sm text-error">{{ "Closing time must be after opening time." | translate }}</p> }
                      }
                    </div>
                  }
                </div>
                @if (!anyOpen()) { <p class="mt-3 p-3 rounded-xl bg-error/5 text-error text-body-sm flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">error</span>{{ "Open at least one day of the week." | translate }}</p> }
                <p class="mt-3 font-body-sm text-body-sm text-outline">{{ "Weekly open time: {{p1}} hours" | translate: { p1: weeklyHours() } }}</p>
              </section>

              <section [class]="card">
                <div class="flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-[22px] text-primary">coffee</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Breaks & buffers" | translate }}</h2></div>
                <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">{{ "Automate mandatory station turnovers and staff meal breaks to avoid appointment overlap." | translate }}</p>
                <div class="space-y-3">
                  <div class="p-4 rounded-xl bg-surface-bright border border-outline-variant/40 space-y-3">
                    <div class="flex items-center justify-between gap-2"><div><p class="font-label-lg text-label-lg text-on-surface">{{ "Daily Break" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "No bookings are offered during the break." | translate }}</p></div><app-toggle [checked]="draft().brk.enabled" (checkedChange)="patchBrk({ enabled: $event })" [label]="'Daily break' | translate" /></div>
                    @if (draft().brk.enabled) {
                      <div class="grid grid-cols-2 gap-3 max-w-sm">
                        <div><label class="block font-label-sm text-label-sm text-on-surface-variant mb-1" for="brk-s">{{ "Start Time" | translate }}</label><input id="brk-s" type="time" [class]="time" [ngModel]="draft().brk.start" (ngModelChange)="patchBrk({ start: $event })" /></div>
                        <div><label class="block font-label-sm text-label-sm text-on-surface-variant mb-1" for="brk-e">{{ "End Time" | translate }}</label><input id="brk-e" type="time" [class]="time" [class.border-error]="breakMins() <= 0" [ngModel]="draft().brk.end" (ngModelChange)="patchBrk({ end: $event })" /></div>
                      </div>
                      <p class="font-body-sm text-body-sm" [class]="breakMins() > 0 ? 'text-outline' : 'text-error'">{{ breakMins() > 0 ? ('Total: {{p1}} minutes automatic calendar block across {{p2}} chairs.' | translate: { p1: breakMins(), p2: store.staff().length }) : ('End time must be after the start time.' | translate) }}</p>
                    }
                  </div>
                  <div class="p-4 rounded-xl bg-surface-bright border border-outline-variant/40 flex items-center justify-between gap-3">
                    <div><p class="font-label-lg text-label-lg text-on-surface">{{ "Station Sanitization & Prep Buffer" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Injected after every completed service" | translate }}</p></div>
                    <select [attr.aria-label]="'Buffer' | translate" class="w-28 h-10 px-2 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-on-surface font-label-md text-label-md focus:border-primary focus:ring-1 focus:ring-primary text-center" [ngModel]="draft().buffer" (ngModelChange)="patchBuffer(+$event)">@for (b of buffers; track b) { <option [ngValue]="b">{{ b === 0 ? ('No buffer' | translate) : ('{{p1}} mins' | translate: { p1: b }) }}</option> }</select>
                  </div>
                </div>
                <div class="pt-4 mt-4 border-t border-outline-variant/20 flex justify-end"><button type="button" (click)="resetBreak()" class="text-primary font-label-md text-label-md font-semibold hover:underline">{{ "Reset to Default" | translate }}</button></div>
              </section>

              <section [class]="card">
                <div class="flex items-center justify-between gap-4 mb-1">
                  <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[22px] text-primary">celebration</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Holidays & closures" | translate }}</h2></div>
                  <button type="button" (click)="openHoliday()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-all active:scale-[0.98]"><span class="material-symbols-outlined text-[16px]">add</span><span>{{ "Add Holiday" | translate }}</span></button>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">{{ "Booking slots are automatically locked on declared public or studio off-days." | translate }}</p>
                <div class="space-y-2">
                  @for (h of upcomingHolidays(); track h.id) {
                    <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 gap-2">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-11 h-11 rounded-xl border bg-surface-container-highest border-outline-variant/60 text-on-surface flex flex-col items-center justify-center shrink-0"><span class="text-[10px] font-bold uppercase tracking-wider">{{ monthOf(h) }}</span><span class="font-headline-sm text-headline-sm leading-none">{{ dayOf(h) }}</span></div>
                        <div class="min-w-0"><span class="font-label-lg text-label-lg text-on-surface block truncate">{{ h.name }}</span><div class="text-on-surface-variant font-body-sm text-body-sm">{{ h.type === 'full' ? ('Full Day Salon Closure' | translate) : ('Half Day (closes {{p1}})' | translate: { p1: h.closeAt }) }}</div></div>
                      </div>
                      <button type="button" class="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error-container/30" [attr.aria-label]="'Remove Holiday' | translate" (click)="removeHoliday(h.id)"><span class="material-symbols-outlined text-[18px]">delete</span></button>
                    </div>
                  } @empty { <p class="text-body-sm text-outline py-3">{{ "No holidays declared." | translate }}</p> }
                </div>
                <div class="pt-4 mt-4 border-t border-outline-variant/20 flex items-center justify-between gap-3 text-on-surface-variant text-label-sm font-label-sm"><span>{{ "Sync with National Gazetted Calendar (India)" | translate }}</span><button type="button" (click)="autoPopulate()" class="text-primary font-semibold hover:underline shrink-0">{{ "Auto-Populate" | translate }}</button></div>
              </section>
            }

            <!-- ============ POLICIES ============ -->
            @if (tab() === 'policies') {
              <section [class]="card + ' space-y-5'">
                <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[22px] text-primary">policy</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Booking, Deposit & No-Show Rules" | translate }}</h2></div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="p-4 rounded-2xl bg-surface-bright border border-outline-variant/40 space-y-3">
                    <div class="flex items-start justify-between gap-4"><div><p class="font-label-lg text-label-lg text-on-surface">{{ "Allow Pay at Salon (Counter Settlement)" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Allows clients to pay cash, UPI, or card at the front desk upon service completion." | translate }}</p></div><app-toggle [checked]="draft().settings.allowPayAtSalon" (checkedChange)="patch({ allowPayAtSalon: $event })" [label]="'Allow pay at salon' | translate" /></div>
                    <p class="flex items-center gap-2 text-label-sm font-label-sm pt-2 border-t border-outline-variant/20" [class]="draft().settings.allowPayAtSalon ? 'text-primary' : 'text-outline'"><span class="material-symbols-outlined text-[16px]">{{ draft().settings.allowPayAtSalon ? 'check_circle' : 'block' }}</span>{{ draft().settings.allowPayAtSalon ? ('Customers see "Pay at Salon" at checkout' | translate) : ('Online payment only' | translate) }}</p>
                  </div>
                  <div class="p-4 rounded-2xl bg-surface-bright border border-outline-variant/40 space-y-3">
                    <div class="flex items-start justify-between gap-4"><div><p class="font-label-lg text-label-lg text-on-surface">{{ "Mandatory Online Payment After {{p1}} No-Shows" | translate: { p1: draft().settings.noShowThreshold } }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Clients who miss appointments repeatedly must pay upfront online." | translate }}</p></div><app-toggle [checked]="draft().settings.requireOnlineAfterNoShows" (checkedChange)="patch({ requireOnlineAfterNoShows: $event })" [label]="'Require online payment after no-shows' | translate" /></div>
                    <div class="flex items-center justify-between gap-2 text-label-sm font-label-sm text-on-surface-variant pt-2 border-t border-outline-variant/20"><span>{{ "Threshold:" | translate }}</span><select [attr.aria-label]="'No-show threshold' | translate" [disabled]="!draft().settings.requireOnlineAfterNoShows" class="h-9 px-2 bg-surface-container-lowest border border-outline-variant/60 rounded-lg font-label-md disabled:opacity-50" [ngModel]="draft().settings.noShowThreshold" (ngModelChange)="patch({ noShowThreshold: +$event })">@for (n of [1, 2, 3, 4, 5]; track n) { <option [ngValue]="n">{{ "{{p1}} missed appointments" | translate: { p1: n } }}</option> }</select></div>
                    @if (draft().settings.requireOnlineAfterNoShows && !draft().settings.allowPayAtSalon) { <p class="text-body-sm text-outline">{{ "Pay at salon is off, so every customer already pays online." | translate }}</p> }
                  </div>
                </div>
                <div class="p-4 rounded-2xl bg-surface-container-low/40 border border-outline-variant/50 space-y-4">
                  <div><p class="font-label-lg text-label-lg text-on-surface">{{ "Client Cancellation Window & Prep Fee" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Configure the fee enforced when a client cancels shortly before the appointment" | translate }}</p></div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label [class]="label" for="cw">{{ "Free Cancellation Window" | translate }}</label><select id="cw" [class]="select" [ngModel]="draft().settings.cancelWindowHrs" (ngModelChange)="patch({ cancelWindowHrs: +$event })">@for (h of [1, 2, 4, 12, 24]; track h) { <option [ngValue]="h">{{ (h > 1 ? "Up to {{p1}} hours before slot" : "Up to {{p1}} hour before slot") | translate: { p1: h } }}</option> }</select></div>
                    <div><label [class]="label" for="cp">{{ "Late Cancellation Penalty Rate" | translate }}</label><select id="cp" [class]="select" [ngModel]="draft().settings.latePenaltyPct" (ngModelChange)="patch({ latePenaltyPct: +$event })">@for (p of [0, 10, 15, 25, 50]; track p) { <option [ngValue]="p">{{ p === 0 ? ('No fee' | translate) : ("{{p1}}% of service total" | translate: { p1: p }) }}</option> }</select></div>
                  </div>
                  <div class="flex items-start gap-2 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface-variant font-body-sm text-body-sm"><span class="material-symbols-outlined text-[18px] text-secondary">sms</span><span><strong class="text-on-surface">{{ "Customers see:" | translate }}</strong> {{ policyPreview() }}</span></div>
                </div>
              </section>
            }

            <!-- ============ PAYMENTS ============ -->
            @if (tab() === 'payments') {
              <section [class]="card + ' space-y-5'" data-testid="razorpay-card">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
                  <div>
                    <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[22px] text-primary">credit_score</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Online Payments with Razorpay" | translate }}</h2></div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{{ "Connect your own Razorpay account. Customer payments settle directly into it; Chairly never holds your money." | translate }}</p>
                  </div>
                  @switch (rzp.status()) {
                    @case ('CONNECTED') { <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary/10 text-tertiary font-label-md text-label-md font-semibold self-start whitespace-nowrap"><span class="w-2 h-2 rounded-full bg-tertiary"></span>{{ "Payment Connected" | translate }}</span> }
                    @case ('PENDING') { <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 font-label-md text-label-md font-semibold self-start whitespace-nowrap"><span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>{{ "Pending" | translate }}</span> }
                    @case ('FAILED') { <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error/10 text-error font-label-md text-label-md font-semibold self-start whitespace-nowrap"><span class="w-2 h-2 rounded-full bg-error"></span>{{ "Failed" | translate }}</span> }
                    @default { <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md font-semibold self-start whitespace-nowrap"><span class="w-2 h-2 rounded-full bg-outline"></span>{{ "Not connected" | translate }}</span> }
                  }
                </div>
                @switch (rzp.status()) {
                  @case ('CONNECTED') {
                    <div class="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface-bright border border-outline-variant/50">
                      <div class="flex items-center gap-3.5">
                        <div class="w-12 h-12 rounded-xl bg-tertiary-fixed/30 border border-tertiary/20 flex items-center justify-center text-tertiary"><span class="material-symbols-outlined text-[28px]">verified_user</span></div>
                        <div>
                          <p class="font-label-lg text-label-lg text-on-surface font-bold">{{ "Razorpay Connected ✓" | translate }}</p>
                          <p class="font-body-sm text-body-sm text-on-surface-variant"><span class="font-mono">{{ rzp.maskedAccount() }}</span>@if (rzp.connectedAt()) { <span> · {{ "Connected on {{p1}}" | translate: { p1: connectedDate() } }}</span> }</p>
                        </div>
                      </div>
                      <button type="button" (click)="disconnectOpen.set(true)" [disabled]="rzp.busy()" class="px-4 py-2 rounded-xl border border-error/40 text-error hover:bg-error-container/40 font-label-md text-label-md font-semibold transition-colors disabled:opacity-60">{{ "Disconnect" | translate }}</button>
                    </div>
                  }
                  @case ('PENDING') {
                    <div class="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/30 text-on-surface-variant"><span class="material-symbols-outlined text-amber-600 animate-spin">progress_activity</span><p class="font-body-md text-body-md">{{ "Razorpay connection is being completed." | translate }}</p></div>
                  }
                  @default {
                    @if (rzp.status() === 'FAILED') {
                      <div class="flex items-center gap-3 p-4 rounded-2xl bg-error/5 border border-error/30 text-error"><span class="material-symbols-outlined">error</span><p class="font-body-md text-body-md">{{ "Razorpay connection failed. Please try again." | translate }}</p></div>
                    }
                    @if (rzp.status() === 'REVOKED') {
                      <div class="flex items-center gap-3 p-4 rounded-2xl bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined">link_off</span><p class="font-body-md text-body-md">{{ "Razorpay was disconnected. Customers cannot pay online until you reconnect." | translate }}</p></div>
                    }
                    <div class="flex flex-wrap items-center justify-between gap-4">
                      <p class="font-body-sm text-body-sm text-on-surface-variant max-w-xl">{{ "You will finish KYC and bank details on Razorpay's own pages. Chairly never sees your keys or documents." | translate }}</p>
                      <button type="button" (click)="rzp.connect()" [disabled]="rzp.busy()" class="px-5 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg text-label-lg font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center gap-2"><span class="material-symbols-outlined text-[20px]">link</span>{{ "Connect Razorpay" | translate }}</button>
                    </div>
                  }
                }
                @if (rzp.error()) { <p class="text-error font-body-sm text-body-sm">{{ rzp.error() | translate }}</p> }
              </section>

              <section [class]="card + ' space-y-3'">
                <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[22px] text-primary">qr_code_2</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "UPI ID for counter payments" | translate }}</h2></div>
                <p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Shown as a QR code on Quick Bill when a customer pays by UPI at your counter. Money goes straight to this UPI ID." | translate }}</p>
                <div class="max-w-md">
                  <label [class]="label" for="upi-id">{{ "Your UPI ID" | translate }}</label>
                  <input id="upi-id" type="text" inputmode="email" autocapitalize="none" autocomplete="off" [class]="input" [class.border-error]="!upiOk()" placeholder="yourshop@okbank" [ngModel]="draft().settings.upiId ?? ''" (ngModelChange)="patch({ upiId: $event.trim() })" />
                  @if (!upiOk()) { <p class="text-body-sm text-error mt-1">{{ "Enter a valid UPI ID like name@bank." | translate }}</p> }
                </div>
              </section>
            }

            <!-- ============ SUBSCRIPTION ============ -->
            @if (tab() === 'subscription') {
              <section [class]="card">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-primary-fixed/30 border border-primary/20 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[28px]">workspace_premium</span></div>
                    <div><div class="flex items-center gap-2 flex-wrap"><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "{{p1}} Tier" | translate: { p1: draft().settings.plan } }}</h2><span class="px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-primary/10 text-primary font-semibold">{{ planBadge() | translate }}</span></div><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Automated booking, billing and reminders for your whole team" | translate }}</p></div>
                  </div>
                  @if (trialDays() > 0) { <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm"><span class="material-symbols-outlined text-[16px]">timelapse</span>{{ "{{p1}} days left in free trial" | translate: { p1: trialDays() } }}</span> }
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 p-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/30">
                  <div><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Team Members" | translate }}</p><p class="text-numeric-stat font-numeric-stat text-on-surface">{{ store.staff().length }}</p></div>
                  <div><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Services Live" | translate }}</p><p class="text-numeric-stat font-numeric-stat text-primary">{{ store.selectedServices().length }}</p></div>
                  @if (draft().settings.trialEndsAt) { <div><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Trial ends on" | translate }}</p><p class="text-headline-md font-headline-md text-on-surface">{{ renewal() }}</p></div> }
                </div>
              </section>

              <section>
                <h3 class="font-label-md text-label-md text-outline uppercase tracking-wider mb-3">{{ "Plans" | translate }}</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  @for (p of admin.plans(); track p.id) {
                    <div class="rounded-2xl p-5 border flex flex-col gap-3" [class]="isCurrentPlan(p.name) ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : p.highlight ? 'border-secondary-container bg-surface-container-lowest' : 'border-outline-variant/40 bg-surface-container-lowest'">
                      <div class="flex items-center justify-between gap-2"><p class="font-headline-sm text-headline-sm text-on-surface">{{ p.name }}</p>
                        @if (isCurrentPlan(p.name)) { <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary text-on-primary">{{ "Current" | translate }}</span> } @else if (p.highlight) { <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary-container text-on-secondary-container">{{ "Popular" | translate }}</span> }
                      </div>
                      <p><span class="text-headline-md font-headline-md text-on-surface">{{ inr(p.price) }}</span><span class="text-body-sm text-outline">/{{ "mo" | translate }}</span></p>
                      <p class="font-body-sm text-body-sm text-on-surface-variant">{{ p.tagline | translate }}</p>
                      <ul class="space-y-1.5 mt-1">@for (f of p.features; track f) { <li class="flex items-start gap-2 font-body-sm text-body-sm text-on-surface"><span class="material-symbols-outlined text-[16px] text-primary mt-0.5">check</span>{{ f | translate }}</li> }</ul>
                    </div>
                  }
                </div>
                <p class="mt-4 flex items-start gap-2 font-body-sm text-body-sm text-on-surface-variant"><span class="material-symbols-outlined text-[18px] text-primary">info</span>{{ "Your plan is activated by the Chairly team when your trial ends. Nothing is charged automatically." | translate }}</p>
              </section>
            }

            <!-- ============ ACCOUNT ============ -->
            @if (tab() === 'account') {
              <section [class]="card">
                <div class="flex items-center gap-2 mb-4"><span class="material-symbols-outlined text-primary">account_circle</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Account" | translate }}</h2></div>
                <div class="divide-y divide-outline-variant/30">
                  <div class="flex items-center justify-between gap-4 py-3"><div class="min-w-0"><p class="font-label-lg text-label-lg text-on-surface">{{ "Name" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant truncate">{{ auth.profile().name }}</p></div><a routerLink="/owner/profile" class="shrink-0 px-3 py-1.5 rounded-xl border border-outline-variant font-label-md text-label-md hover:bg-surface-container-low">{{ "Edit profile" | translate }}</a></div>
                  <div class="flex items-center justify-between gap-4 py-3"><div class="min-w-0"><p class="font-label-lg text-label-lg text-on-surface">{{ "Login email" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant truncate">{{ auth.profile().email || '—' }}</p></div><span class="shrink-0 font-label-sm text-label-sm text-outline">{{ signInMethod() | translate }}</span></div>
                  @if (hasPassword()) {
                    <div class="flex items-center justify-between gap-4 py-3"><div><p class="font-label-lg text-label-lg text-on-surface">{{ "Password" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "We will email you a secure link to set a new password." | translate }}</p></div><button type="button" (click)="resetPassword()" [disabled]="resetting()" class="shrink-0 px-3 py-1.5 rounded-xl border border-outline-variant font-label-md text-label-md hover:bg-surface-container-low disabled:opacity-50">{{ "Change password" | translate }}</button></div>
                  }
                </div>
              </section>
              <section [class]="card">
                <div class="flex items-center justify-between gap-4">
                  <div><p class="font-label-lg text-label-lg text-on-surface">{{ "Sign out" | translate }}</p><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Sign out of Chairly on this device." | translate }}</p></div>
                  <button type="button" (click)="signOut()" class="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-error/40 text-error hover:bg-error-container/40 font-label-md text-label-md font-semibold"><span class="material-symbols-outlined text-[18px]">logout</span>{{ "Log out" | translate }}</button>
                </div>
              </section>
            }
          </div>
        </div>
      </div>
    </main>

    @if (dirty()) {
      <div class="fixed bottom-0 right-0 left-0 lg:left-64 z-30 bg-surface-container-lowest/95 backdrop-blur border-t border-outline-variant/40 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)] no-print">
        <div class="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <span class="hidden sm:flex items-center gap-2 font-body-sm text-body-sm" [class]="valid() ? 'text-on-surface-variant' : 'text-error'"><span class="w-2 h-2 rounded-full animate-pulse" [class]="valid() ? 'bg-secondary' : 'bg-error'"></span>{{ (valid() ? 'You have unsaved changes' : 'Fix the highlighted fields to save') | translate }}</span>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button type="button" (click)="discard()" [disabled]="saving()" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface font-label-lg text-label-lg hover:bg-surface-container-low disabled:opacity-50">{{ "Discard" | translate }}</button>
            <button type="button" (click)="save()" [disabled]="saving()" class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold shadow-sm hover:bg-primary-container disabled:opacity-60">
              <span class="material-symbols-outlined text-[18px]" [class.animate-spin]="saving()">{{ saving() ? 'progress_activity' : 'check' }}</span>{{ "Save Changes" | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <app-modal [open]="holidayOpen()" [title]="'Add Holiday' | translate" (closed)="holidayOpen.set(false)">
      <form class="space-y-4" (ngSubmit)="saveHoliday()" #hf="ngForm">
        <div><label [class]="label" for="h-name">{{ "Holiday name" | translate }}</label><input id="h-name" name="name" maxlength="60" [class]="input" [(ngModel)]="hName" required [placeholder]="'e.g., Diwali' | translate" /></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label [class]="label" for="h-date">{{ "Date" | translate }}</label><input id="h-date" name="date" type="date" [class]="input" [(ngModel)]="hDate" [min]="todayKey" required /></div>
          <div><label [class]="label" for="h-type">{{ "Closure" | translate }}</label><select id="h-type" name="type" [class]="input" [(ngModel)]="hType"><option value="full">{{ "Full day" | translate }}</option><option value="half">{{ "Half day" | translate }}</option></select></div>
        </div>
        @if (hType === 'half') { <div><label [class]="label" for="h-close">{{ "Closes at" | translate }}</label><input id="h-close" name="close" type="time" [class]="input" [(ngModel)]="hClose" required /></div> }
        @if (holidayDupe()) { <p class="text-body-sm text-error">{{ "A holiday is already declared on this date." | translate }}</p> }
        <div class="flex justify-end gap-3 pt-4 border-t border-outline-variant/20"><button type="button" [class]="ghost" (click)="holidayOpen.set(false)">{{ "Cancel" | translate }}</button><button type="submit" [class]="primary" [disabled]="hf.invalid || holidayDupe()">{{ "Add holiday" | translate }}</button></div>
      </form>
    </app-modal>

    <app-modal [open]="disconnectOpen()" [title]="'Disconnect Razorpay?' | translate" (closed)="disconnectOpen.set(false)">
      <p class="font-body-md text-body-md text-on-surface-variant">{{ "Customers will not be able to pay online until you reconnect. Existing payments are not affected." | translate }}</p>
      <div class="flex justify-end gap-3 pt-4 mt-4 border-t border-outline-variant/20">
        <button type="button" [class]="ghost" (click)="disconnectOpen.set(false)">{{ "Cancel" | translate }}</button>
        <button type="button" class="px-5 py-2 rounded-lg font-label-md text-label-md font-semibold bg-error text-on-error disabled:opacity-50" [disabled]="rzp.busy()" (click)="disconnect()">{{ "Disconnect" | translate }}</button>
      </div>
    </app-modal>
  `,
})
export class OwnerSettings implements HasUnsavedChanges {
  protected readonly store = inject(SalonStore);
  protected readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly admin = inject(AdminStore);
  protected readonly rzp = inject(PaymentConnectService);
  private readonly lang = inject(LangService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly inr = inr;
  protected readonly tabs = TABS;
  protected readonly days = DAYS;
  protected readonly buffers = [0, 5, 10, 15, 20, 30];
  protected readonly select = SELECT;
  protected readonly time = TIME;
  protected readonly card = CARD;
  protected readonly input = INPUT;
  protected readonly label = LABEL;
  protected readonly primary = BTN_PRIMARY;
  protected readonly ghost = BTN_GHOST;
  protected readonly todayKey = dateKey(new Date());
  protected readonly canShare = typeof navigator !== 'undefined' && !!navigator.share;

  protected readonly tab = signal<Tab>('general');
  protected readonly draft = signal<Draft>(this.snapshot());
  protected readonly saving = signal(false);
  protected readonly resetting = signal(false);
  protected readonly holidayOpen = signal(false);
  protected readonly disconnectOpen = signal(false);
  protected hName = '';
  protected hDate = '';
  protected hType: 'full' | 'half' = 'full';
  protected hClose = '13:00';

  constructor() {
    void this.admin.loadPlans();
    const flag = this.route.snapshot.queryParamMap.get('razorpay');
    // Deep links: /owner/settings;tab=hours (setup-health) or ?tab=hours.
    const want = (this.route.snapshot.paramMap.get('tab') ?? this.route.snapshot.queryParamMap.get('tab')) as Tab | null;
    if (want && TABS.some((t) => t.key === want)) this.tab.set(want);
    if (flag) this.tab.set('payments');
    void this.rzp.load().then(() => this.rzp.handleReturn(flag));
  }

  protected readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.snapshot()));
  protected readonly gstinOk = computed(() => !this.draft().settings.gstRegistered || GSTIN_PATTERN.test(this.draft().settings.gstin));
  protected readonly upiOk = computed(() => !(this.draft().settings.upiId ?? '').trim() || UPI_PATTERN.test(this.draft().settings.upiId!));
  protected readonly breakMins = computed(() => toMin(this.draft().brk.end) - toMin(this.draft().brk.start));
  protected readonly anyOpen = computed(() => this.draft().timings.some((t) => t.open));
  protected readonly hoursOk = computed(() => this.anyOpen() && this.draft().timings.every((t) => this.dayOk(t)) && (!this.draft().brk.enabled || this.breakMins() > 0));
  protected readonly valid = computed(() => this.gstinOk() && this.upiOk() && this.hoursOk());
  protected readonly weeklyHours = computed(() => Math.round(this.draft().timings.reduce((a, t) => a + (t.open && this.dayOk(t) ? toMin(t.end) - toMin(t.start) : 0), 0) / 6) / 10);
  protected readonly upcomingHolidays = computed(() => this.draft().settings.holidays.filter((h) => h.date >= this.todayKey));
  protected readonly bookingLink = computed(() => `${environment.publicBaseUrl}/s/${this.store.profile().slug}`);
  protected readonly policyPreview = computed(() => {
    const s = this.draft().settings;
    return s.latePenaltyPct > 0
      ? tr('"Free cancel up to {{p1}}h before. Within {{p2}}h, {{p3}}% prep fee applies."', { p1: s.cancelWindowHrs, p2: s.cancelWindowHrs, p3: s.latePenaltyPct })
      : tr('Free cancellation up to {{p1}}h before the appointment.', { p1: s.cancelWindowHrs });
  });

  protected readonly connectedDate = computed(() => {
    const c = this.rzp.connectedAt();
    return c ? new Date(c).toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  });
  protected readonly planBadge = computed(() => {
    const st = this.draft().settings.billingStatus;
    return st === 'active' ? 'Active Plan' : st === 'expired' ? 'Trial ended' : st === 'suspended' ? 'Suspended' : 'Free trial';
  });
  protected readonly trialDays = computed(() => (this.draft().settings.trialEndsAt ? this.admin.daysLeft(this.draft().settings.trialEndsAt) : 0));
  protected readonly renewal = computed(() => new Date(this.draft().settings.trialEndsAt + 'T00:00').toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short', year: 'numeric' }));
  protected readonly hasPassword = computed(() => !!this.auth.user()?.providerData.some((p) => p.providerId === 'password'));
  protected readonly signInMethod = computed(() => {
    const ids = this.auth.user()?.providerData.map((p) => p.providerId) ?? [];
    return ids.includes('google.com') ? 'Google sign-in' : ids.includes('password') ? 'Email & password' : ids.includes('phone') ? 'Mobile OTP' : '';
  });

  private snapshot(): Draft {
    return { settings: structuredClone(this.store.settings()), brk: { ...this.store.brk() }, buffer: this.store.buffer(), timings: structuredClone(this.store.timings()) };
  }

  hasUnsavedChanges() {
    return this.dirty();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(e: BeforeUnloadEvent) {
    if (this.dirty()) e.preventDefault();
  }

  protected tabHasError(t: Tab) {
    return (t === 'general' && !this.gstinOk()) || (t === 'payments' && !this.upiOk()) || (t === 'hours' && !this.hoursOk());
  }

  protected savedAt(t: Date) {
    return t.toLocaleTimeString(LOCALE(), { hour: 'numeric', minute: '2-digit' });
  }

  patch(p: Partial<SalonSettings>) {
    this.draft.update((d) => ({ ...d, settings: { ...d.settings, ...p } }));
  }
  patchBrk(p: Partial<BreakSettings>) {
    this.draft.update((d) => ({ ...d, brk: { ...d.brk, ...p } }));
  }
  patchBuffer(n: number) {
    this.draft.update((d) => ({ ...d, buffer: n }));
  }
  patchDay(i: number, p: Partial<DayTiming>) {
    this.draft.update((d) => ({ ...d, timings: d.timings.map((t, idx) => (idx === i ? { ...t, ...p } : t)) }));
  }
  protected dayOk(t: DayTiming) {
    return !t.open || toMin(t.end) > toMin(t.start);
  }
  copyMonday() {
    const mon = this.draft().timings[0];
    this.draft.update((d) => ({ ...d, timings: d.timings.map(() => ({ ...mon })) }));
    this.toast.info("Monday's hours applied to all days");
  }

  monthOf(h: Holiday) {
    return new Date(h.date + 'T00:00').toLocaleDateString(LOCALE(), { month: 'short' });
  }
  dayOf(h: Holiday) {
    return h.date.slice(8, 10);
  }
  protected holidayDupe() {
    return !!this.hDate && this.draft().settings.holidays.some((h) => h.date === this.hDate);
  }
  openHoliday() {
    this.hName = '';
    this.hDate = '';
    this.hType = 'full';
    this.hClose = '13:00';
    this.holidayOpen.set(true);
  }
  saveHoliday() {
    if (this.holidayDupe()) return;
    const h: Holiday = { id: 'h' + Date.now().toString(36), date: this.hDate, name: this.hName.trim(), type: this.hType, closeAt: this.hType === 'half' ? this.hClose : undefined };
    this.patch({ holidays: [...this.draft().settings.holidays, h].sort((a, b) => a.date.localeCompare(b.date)) });
    this.holidayOpen.set(false);
  }
  removeHoliday(id: string) {
    this.patch({ holidays: this.draft().settings.holidays.filter((h) => h.id !== id) });
  }
  autoPopulate() {
    const y = new Date().getFullYear();
    const list = [['01-26', 'Republic Day'], ['08-15', 'Independence Day'], ['10-02', 'Gandhi Jayanti']];
    const have = new Set(this.draft().settings.holidays.map((h) => h.date));
    const add: Holiday[] = [];
    for (const [md, name] of list) {
      let date = `${y}-${md}`;
      if (date < this.todayKey) date = `${y + 1}-${md}`;
      if (!have.has(date)) add.push({ id: 'h' + md + date, date, name, type: 'full' });
    }
    if (!add.length) return this.toast.info('National holidays are already added.');
    this.patch({ holidays: [...this.draft().settings.holidays, ...add].sort((a, b) => a.date.localeCompare(b.date)) });
    this.toast.success('{{p1}} national holidays added', { p1: add.length });
  }
  resetBreak() {
    this.patchBrk({ enabled: true, start: '13:00', end: '14:00', blockSlots: true });
    this.patchBuffer(10);
  }

  previewHindi() {
    this.lang.set('hi');
    this.toast.info('Language switched to Hindi. Toggle it again on any customer page.');
  }

  protected isCurrentPlan(name: string) {
    return this.draft().settings.billingStatus === 'active' && this.draft().settings.plan === name;
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.bookingLink());
      this.toast.success('Link copied');
    } catch {
      this.toast.error('Could not copy the link.');
    }
  }
  async shareLink() {
    try {
      await navigator.share({ title: this.store.profile().name, url: this.bookingLink() });
    } catch {
      /* share sheet closed */
    }
  }

  async disconnect() {
    await this.rzp.disconnect();
    this.disconnectOpen.set(false);
  }

  async resetPassword() {
    const email = this.auth.profile().email;
    if (!email || this.resetting()) return;
    this.resetting.set(true);
    try {
      await this.auth.resetPassword(email);
      this.toast.success('Password reset link sent to {{p1}}', { p1: email });
    } catch (e) {
      this.toast.error(authMessage(e));
    } finally {
      this.resetting.set(false);
    }
  }

  async signOut() {
    if (this.dirty() && !confirm(tr('You have unsaved changes. Leave this page and discard them?'))) return;
    this.draft.set(this.snapshot());
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }

  async save() {
    if (!this.gstinOk()) {
      this.tab.set('general');
      return this.toast.error('Enter a valid GSTIN or turn off GST registered.');
    }
    if (!this.upiOk()) {
      this.tab.set('payments');
      return this.toast.error('Enter a valid UPI ID like name@bank.');
    }
    if (!this.hoursOk()) {
      this.tab.set('hours');
      return this.toast.error(!this.anyOpen() ? 'Open at least one day of the week.' : this.breakMins() <= 0 && this.draft().brk.enabled ? 'Break end must be after the break start.' : 'Closing time must be after opening time.');
    }
    if (this.saving()) return;
    this.saving.set(true);
    const d = this.draft();
    this.store.settings.set(structuredClone(d.settings));
    this.store.brk.set({ ...d.brk });
    this.store.buffer.set(d.buffer);
    this.store.timings.set(structuredClone(d.timings));
    try {
      await this.store.flush();
      this.toast.success('Settings saved');
    } finally {
      this.saving.set(false);
    }
  }

  discard() {
    this.draft.set(this.snapshot());
    this.toast.info('Changes discarded');
  }

}
