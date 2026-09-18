import { TranslatePipe } from '@ngx-translate/core';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BankAccount, BreakSettings, Holiday, SalonSettings } from '../../../core/models';
import { AdminStore } from '../../../core/services/admin.store';
import { LangService } from '../../../core/services/lang.service';
import { PaymentConnectService } from '../../../core/services/payment-connect.service';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { GSTIN_PATTERN } from '../../../core/utils/gst';
import { dateKey, inr, toMin, LOCALE } from '../../../core/utils/time';
import { Topbar } from '../../../shared/layout/topbar';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL } from '../../../shared/ui/form-classes';
import { Modal } from '../../../shared/ui/modal';
import { Toggle } from '../../../shared/ui/toggle';

type Tab = 'general' | 'policies' | 'payments' | 'subscription';
interface Draft { settings: SalonSettings; brk: BreakSettings; buffer: number }

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'general', label: 'General & Operations', icon: 'tune' },
  { key: 'policies', label: 'Booking & No-Show Policies', icon: 'gavel' },
  { key: 'payments', label: 'Payment & Payouts', icon: 'account_balance' },
  { key: 'subscription', label: 'Salon Subscription', icon: 'workspace_premium' },
];
const SELECT = 'w-full h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-on-surface font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary';
const TIME = 'w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-on-surface font-body-md text-body-md text-center focus:border-primary focus:ring-1 focus:ring-primary';
const CARD = 'bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 nordic-shadow';

@Component({
  selector: 'app-owner-settings',
  imports: [FormsModule, Topbar, Modal, Toggle, TranslatePipe],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-2"><span class="material-symbols-outlined text-primary">settings</span><span class="font-headline-sm text-headline-sm text-on-surface">{{ "Settings" | translate }}</span></div>
      <ng-container right>
        <span class="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/30 font-label-sm text-label-sm text-on-surface"><span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>{{ store.profile().name }}</span>
      </ng-container>
    </app-topbar>

    <main class="lg:pl-64 pt-16 min-h-screen bg-background">
      <div class="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-outline-variant/20">
          <div>
            <div class="flex items-center gap-2"><span class="font-label-sm text-label-sm text-primary uppercase tracking-wider">{{ "Salon Configuration" | translate }}</span><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">{{ "ADMIN CONSOLE" | translate }}</span></div>
            <h1 class="text-headline-lg font-headline-lg text-on-surface tracking-tight mt-0.5">{{ "Owner & Operations Settings" | translate }}</h1>
            <p class="font-body-md text-body-md text-on-surface-variant">{{ "Manage your salon tier, automated cancellation policies, payout settlement schedules, and regional hours." | translate }}</p>
          </div>
          <div class="flex items-center gap-3">
            <button type="button" (click)="discard()" [disabled]="!dirty()" class="px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low font-label-lg text-label-lg text-on-surface transition-all active:scale-[0.98] disabled:opacity-50">{{ "Discard Draft" | translate }}</button>
            <button type="button" (click)="save()" [disabled]="!dirty()" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary font-label-lg text-label-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"><span class="material-symbols-outlined text-[18px]">check_circle</span><span>{{ "Save Changes" | translate }}</span></button>
          </div>
        </div>

        <div class="flex overflow-x-auto no-scrollbar gap-2 border-b border-outline-variant/30 pb-3 text-label-md font-label-md" role="tablist">
          @for (t of tabs; track t.key) {
            <button type="button" role="tab" [attr.aria-selected]="tab() === t.key" (click)="tab.set(t.key)" class="px-4 py-2 rounded-xl flex items-center gap-2 shrink-0 transition-colors" [class]="tab() === t.key ? 'bg-primary text-on-primary shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'"><span class="material-symbols-outlined text-[18px]">{{ t.icon }}</span>{{ (t.label) | translate }}</button>
          }
        </div>

        @if (tab() === 'subscription') {
          <div [class]="card + ' relative overflow-hidden'">
            <div class="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-primary/5 pointer-events-none blur-xl"></div>
            <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-primary-fixed/30 border border-primary/20 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[28px]">workspace_premium</span></div>
                <div><div class="flex items-center gap-2 flex-wrap"><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "{{p1}} Tier" | translate: { p1: (draft().settings.plan) } }}</h2><span class="px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-primary/10 text-primary font-semibold">{{ "Active Plan" | translate }}</span></div><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Automated booking, billing and reminders for your whole team" | translate }}</p></div>
              </div>
              @if (trialDays() > 0) { <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm border border-secondary/20"><span class="material-symbols-outlined text-[16px]">timelapse</span><span>{{ "{{p1}} days left in free trial" | translate: { p1: (trialDays()) } }}</span></div> }
              @else { <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm"><span class="material-symbols-outlined text-[16px]">verified</span><span>{{ "Trial completed" | translate }}</span></div> }
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4 p-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/30">
              <div><span class="font-body-sm text-body-sm text-on-surface-variant">{{ "Team Members" | translate }}</span><div class="flex items-baseline gap-2 mt-1"><span class="text-numeric-stat font-numeric-stat text-on-surface">{{ store.staff().length }}</span><span class="font-body-sm text-body-sm text-outline">{{ "Stylists" | translate }}</span></div><p class="font-body-sm text-body-sm text-on-surface-variant mt-2">{{ "Unlimited on this plan" | translate }}</p></div>
              <div><span class="font-body-sm text-body-sm text-on-surface-variant">{{ "Services Live" | translate }}</span><div class="flex items-baseline gap-2 mt-1"><span class="text-numeric-stat font-numeric-stat text-primary">{{ store.selectedServices().length }}</span><span class="font-label-sm text-label-sm text-tertiary">{{ "Bookable online" | translate }}</span></div></div>
              <div><span class="font-body-sm text-body-sm text-on-surface-variant">{{ "Next Auto-Renewal" | translate }}</span><div class="flex items-baseline gap-2 mt-1"><span class="text-headline-md font-headline-md text-on-surface">{{ renewal() }}</span></div><p class="font-body-sm text-body-sm text-outline">{{ "Billed {{p1}}/mo after trial" | translate: { p1: (inr(planPrice())) } }}</p></div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-outline-variant/20">
              <div class="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm"><span class="material-symbols-outlined text-[16px] text-primary">lock</span><span>{{ "Encrypted billing lifecycle" | translate }}</span></div>
              <div class="flex items-center gap-3">
                <button type="button" (click)="toast.info('No invoices yet — your first invoice is issued when the trial ends.')" class="px-4 py-2 rounded-xl text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors">{{ "View Invoice Archive" | translate }}</button>
                <button type="button" (click)="toast.success('Pro plan locked in. You will be billed {{p1}} on {{p2}}.', { p1: inr(planPrice()), p2: renewal() })" class="px-5 py-2.5 rounded-xl bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary font-label-lg text-label-lg shadow-sm transition-all active:scale-[0.98]">{{ "Upgrade & Lock In Pro" | translate }}</button>
              </div>
            </div>
          </div>
        }

        @if (tab() === 'general') {
          <div [class]="card">
            <div class="flex items-center gap-2 mb-4"><span class="material-symbols-outlined text-[22px] text-primary">public</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Regional & Localization" | translate }}</h2></div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label [class]="label" for="st-lang">{{ "Default Salon Language" | translate }}</label><select id="st-lang" [class]="select" disabled><option>{{ "English (India)" | translate }}</option></select></div>
              <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3 self-end"><div><div class="font-label-md text-label-md text-on-surface">{{ "Hindi Dual-Support" | translate }}</div><div class="font-body-sm text-body-sm text-on-surface-variant">{{ "हिन्दी toggle for customers & staff" | translate }}</div></div><app-toggle [checked]="draft().settings.hindiSupport" (checkedChange)="patch({ hindiSupport: $event })" [label]="'Hindi support' | translate" /></div>
              <div><span [class]="label">{{ "Counter & Online Currency" | translate }}</span><div class="flex items-center gap-3 p-3 bg-surface-container-lowest border border-outline-variant/50 rounded-xl"><div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center font-bold text-primary font-headline-sm">₹</div><div><span class="font-label-md text-label-md text-on-surface">{{ "INR (₹) - Indian Rupee" | translate }}</span><p class="font-body-sm text-body-sm text-outline">{{ "All prices include GST" | translate }}</p></div></div></div>
            </div>
            <div class="pt-4 mt-4 border-t border-outline-variant/20 flex items-center justify-between text-on-surface-variant text-label-sm font-label-sm"><span>{{ "Timezone: Asia/Kolkata (IST)" | translate }}</span>
              <button type="button" (click)="previewHindi()" class="text-primary hover:underline">{{ "Preview in Hindi" | translate }}</button></div>
          </div>

          <div [class]="card">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined">receipt_long</span></div>
                <div>
                  <h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "GST & Invoicing" | translate }}</h2>
                  <p class="font-body-sm text-body-sm text-on-surface-variant">{{ (draft().settings.gstRegistered ? "Prices are always GST-inclusive. Bills show the tax breakdown inside the price." : "Prices are always GST-inclusive. No GST is added or shown on bills.") | translate }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0"><span class="font-label-md text-label-md text-on-surface">{{ "GST registered" | translate }}</span><app-toggle [checked]="draft().settings.gstRegistered" (checkedChange)="patch({ gstRegistered: $event })" [label]="'GST registered' | translate" /></div>
            </div>
            @if (draft().settings.gstRegistered) {
              <div class="mt-4 pt-4 border-t border-outline-variant/20 max-w-md">
                <label [class]="label" for="gstin">{{ "GSTIN" | translate }}</label>
                <input id="gstin" type="text" maxlength="15" autocomplete="off" [class]="input + ' uppercase font-mono tracking-wider'" [class.border-error]="!gstinOk()" [placeholder]="'29ABCDE1234F1Z5' | translate" [ngModel]="draft().settings.gstin" (ngModelChange)="patch({ gstin: ($event || '').toUpperCase() })" />
                <p class="text-body-sm mt-1" [class]="gstinOk() ? 'text-outline' : 'text-error'">{{ gstinOk() ? ('Printed on every bill. GST rate: 18% (CGST 9% + SGST 9%).' | translate) : ('Enter a valid 15-character GSTIN, e.g. 29ABCDE1234F1Z5.' | translate) }}</p>
              </div>
            }
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div [class]="card + ' lg:col-span-6 flex flex-col justify-between'">
              <div>
                <div class="flex items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
                  <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[24px] text-primary">celebration</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Declared Holiday Exceptions" | translate }}</h2></div>
                  <button type="button" (click)="openHoliday()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-all active:scale-[0.98]"><span class="material-symbols-outlined text-[16px]">add</span><span>{{ "Add Holiday" | translate }}</span></button>
                </div>
                <p class="font-body-md text-body-md text-on-surface-variant my-3">{{ "Booking slots are automatically locked on declared public or studio off-days." | translate }}</p>
                <div class="space-y-3 mt-4">
                  @for (h of draft().settings.holidays; track h.id; let i = $index) {
                    <div class="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 gap-2">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0" [class]="i === 0 ? 'bg-secondary-fixed/40 border-secondary/20 text-on-secondary-fixed-variant' : 'bg-surface-container-highest border-outline-variant/60 text-on-surface'"><span class="text-[10px] font-bold uppercase tracking-wider">{{ monthOf(h) }}</span><span class="font-headline-sm text-headline-sm leading-none">{{ dayOf(h) }}</span></div>
                        <div class="min-w-0"><span class="font-label-lg text-label-lg text-on-surface block truncate">{{ h.name }}</span><div class="text-on-surface-variant font-body-sm text-body-sm">{{ h.type === 'full' ? ('Full Day Salon Closure' | translate) : ('Half Day (closes {{p1}})' | translate: { p1: h.closeAt }) }}</div></div>
                      </div>
                      <button type="button" class="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error-container/30" [title]="'Remove Holiday' | translate" (click)="removeHoliday(h.id)"><span class="material-symbols-outlined text-[18px]">delete</span></button>
                    </div>
                  } @empty { <p class="text-body-sm text-outline py-4">{{ "No holidays declared." | translate }}</p> }
                </div>
              </div>
              <div class="pt-4 mt-4 border-t border-outline-variant/20 flex items-center justify-between text-on-surface-variant text-label-sm font-label-sm"><span>{{ "Sync with National Gazetted Calendar (India)" | translate }}</span><button type="button" (click)="autoPopulate()" class="text-primary font-semibold hover:underline">{{ "Auto-Populate" | translate }}</button></div>
            </div>

            <div [class]="card + ' lg:col-span-6 flex flex-col justify-between'">
              <div>
                <div class="flex items-center gap-2 pb-4 border-b border-outline-variant/20"><span class="material-symbols-outlined text-[24px] text-primary">coffee</span><h2 class="text-headline-sm font-headline-sm text-on-surface">{{ "Universal Breaks & Sanitization Buffers" | translate }}</h2></div>
                <p class="font-body-md text-body-md text-on-surface-variant my-3">{{ "Automate mandatory station turnovers and staff meal breaks to avoid appointment overlap." | translate }}</p>
                <div class="space-y-4 mt-4">
                  <div class="p-4 rounded-xl bg-surface-bright border border-outline-variant/40 space-y-3">
                    <div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px] text-primary">schedule</span><span class="font-label-md text-label-md text-on-surface">{{ "Daily Break" | translate }}</span></div><app-toggle [checked]="draft().brk.enabled" (checkedChange)="patchBrk({ enabled: $event })" [label]="'Daily break' | translate" /></div>
                    @if (draft().brk.enabled) {
                      <div class="grid grid-cols-2 gap-3">
                        <div><label class="block font-label-sm text-label-sm text-on-surface-variant mb-1" for="brk-s">{{ "Start Time" | translate }}</label><input id="brk-s" type="time" [class]="time" [ngModel]="draft().brk.start" (ngModelChange)="patchBrk({ start: $event })" /></div>
                        <div><label class="block font-label-sm text-label-sm text-on-surface-variant mb-1" for="brk-e">{{ "End Time" | translate }}</label><input id="brk-e" type="time" [class]="time" [ngModel]="draft().brk.end" (ngModelChange)="patchBrk({ end: $event })" /></div>
                      </div>
                      <span class="font-body-sm text-body-sm block" [class]="breakMins() > 0 ? 'text-outline' : 'text-error'">{{ breakMins() > 0 ? ('Total: {{p1}} minutes automatic calendar block across {{p2}} chairs.' | translate: { p1: breakMins(), p2: store.staff().length }) : ('End time must be after the start time.' | translate) }}</span>
                    }
                  </div>
                  <div class="p-4 rounded-xl bg-surface-bright border border-outline-variant/40 flex items-center justify-between gap-3">
                    <div><span class="font-label-md text-label-md text-on-surface">{{ "Station Sanitization & Prep Buffer" | translate }}</span><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Injected after every completed service" | translate }}</p></div>
                    <div class="w-28"><select [attr.aria-label]="'Buffer' | translate" class="w-full h-10 px-2 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-on-surface font-label-md text-label-md focus:border-primary focus:ring-1 focus:ring-primary text-center" [ngModel]="draft().buffer" (ngModelChange)="patchBuffer(+$event)">@for (b of buffers; track b) { <option [ngValue]="b">{{ "{{p1}} mins" | translate: { p1: (b) } }}</option> }</select></div>
                  </div>
                </div>
              </div>
              <div class="pt-4 mt-4 border-t border-outline-variant/20 flex items-center justify-between"><span class="font-body-sm text-body-sm text-on-surface-variant">{{ "Changes reflect on the client booking page once saved" | translate }}</span><button type="button" (click)="resetBreak()" class="text-primary font-label-sm text-label-sm font-semibold hover:underline">{{ "Reset to Default" | translate }}</button></div>
            </div>
          </div>
        }

        @if (tab() === 'policies') {
          <div [class]="card + ' lg:p-7 space-y-6'">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-outline-variant/20">
              <div><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[24px] text-primary">policy</span><h2 class="text-headline-md font-headline-md text-on-surface">{{ "Booking, Deposit & No-Show Rules" | translate }}</h2></div><p class="font-body-md text-body-md text-on-surface-variant mt-0.5">{{ "Protect your chair inventory and reduce empty slots with automated fee enforcement and checkout gates." | translate }}</p></div>
              <span class="px-3 py-1 rounded-full bg-tertiary/10 text-tertiary font-label-sm text-label-sm self-start sm:self-auto">{{ "Rules Active on {{p1}} Chairs" | translate: { p1: (store.staff().length) } }}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="p-5 rounded-2xl bg-surface-bright border border-outline-variant/40 flex flex-col justify-between space-y-4">
                <div class="flex items-start justify-between gap-4"><div class="space-y-1"><span class="font-label-lg text-label-lg text-on-surface">{{ "Allow Pay at Salon (Counter Settlement)" | translate }}</span><p class="font-body-md text-body-md text-on-surface-variant">{{ "Allows clients to pay cash, UPI, or card at the front desk upon service completion." | translate }}</p></div><app-toggle [checked]="draft().settings.allowPayAtSalon" (checkedChange)="patch({ allowPayAtSalon: $event })" [label]="'Allow pay at salon' | translate" /></div>
                <div class="flex items-center gap-2 text-label-sm font-label-sm pt-2 border-t border-outline-variant/20" [class]="draft().settings.allowPayAtSalon ? 'text-primary' : 'text-outline'"><span class="material-symbols-outlined text-[16px]">{{ draft().settings.allowPayAtSalon ? 'check_circle' : 'block' }}</span><span>{{ draft().settings.allowPayAtSalon ? ('Customers see "Pay at Salon" at checkout' | translate) : ('Online payment only' | translate) }}</span></div>
              </div>
              <div class="p-5 rounded-2xl bg-surface-bright border border-outline-variant/40 flex flex-col justify-between space-y-4">
                <div class="flex items-start justify-between gap-4"><div class="space-y-1"><div class="flex items-center gap-2 flex-wrap"><span class="font-label-lg text-label-lg text-on-surface">{{ "Mandatory Online Payment After {{p1}} No-Shows" | translate: { p1: (draft().settings.noShowThreshold) } }}</span><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/20">{{ "Fraud & Loss Protection" | translate }}</span></div><p class="font-body-md text-body-md text-on-surface-variant">{{ "Clients who miss appointments repeatedly must pay upfront online." | translate }}</p></div><app-toggle [checked]="draft().settings.requireOnlineAfterNoShows" (checkedChange)="patch({ requireOnlineAfterNoShows: $event })" [label]="'Require online payment after no-shows' | translate" /></div>
                <div class="flex items-center justify-between gap-2 text-label-sm font-label-sm text-on-surface-variant pt-2 border-t border-outline-variant/20"><span>{{ "Threshold:" | translate }}</span><select [attr.aria-label]="'No-show threshold' | translate" class="h-9 px-2 bg-surface-container-lowest border border-outline-variant/60 rounded-lg font-label-md" [ngModel]="draft().settings.noShowThreshold" (ngModelChange)="patch({ noShowThreshold: +$event })">@for (n of [1, 2, 3, 4, 5]; track n) { <option [ngValue]="n">{{ "{{p1}} missed appointments" | translate: { p1: (n) } }}</option> }</select></div>
              </div>
            </div>
            <div class="p-5 rounded-2xl bg-surface-container-low/40 border border-outline-variant/50 space-y-4">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div><span class="font-label-lg text-label-lg text-on-surface">{{ "Client Cancellation Window & Prep Fee" | translate }}</span><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Configure the fee enforced when a client cancels shortly before the appointment" | translate }}</p></div>
                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm"><span class="material-symbols-outlined text-[18px] text-secondary">shield</span><span class="font-label-sm text-label-sm text-on-surface font-medium">{{ "Live Policy:" | translate }} <strong class="text-secondary">{{ "{{p1}}% fee within {{p2}} hrs" | translate: { p1: (draft().settings.latePenaltyPct), p2: (draft().settings.cancelWindowHrs) } }}</strong></span></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div><label [class]="label" for="cw">{{ "Free Cancellation Window" | translate }}</label><select id="cw" [class]="select" [ngModel]="draft().settings.cancelWindowHrs" (ngModelChange)="patch({ cancelWindowHrs: +$event })">@for (h of [1, 2, 4, 12, 24]; track h) { <option [ngValue]="h">{{ (h > 1 ? "Up to {{p1}} hours before slot" : "Up to {{p1}} hour before slot") | translate: { p1: h } }}</option> }</select></div>
                <div><label [class]="label" for="cp">{{ "Late Cancellation Penalty Rate" | translate }}</label><select id="cp" [class]="select" [ngModel]="draft().settings.latePenaltyPct" (ngModelChange)="patch({ latePenaltyPct: +$event })">@for (p of [10, 15, 25, 50]; track p) { <option [ngValue]="p">{{ "{{p1}}% of service total" | translate: { p1: (p) } }}</option> }</select></div>
                <div><span [class]="label">{{ "Policy Notice in SMS & Email" | translate }}</span><div class="min-h-11 px-3.5 py-2 bg-surface-container-lowest border border-outline-variant/60 rounded-xl flex items-center text-on-surface-variant font-body-sm text-body-sm">{{ '"Free cancel up to {{p1}}h before. Within {{p2}}h, {{p3}}% prep fee applies."' | translate: { p1: (draft().settings.cancelWindowHrs), p2: (draft().settings.cancelWindowHrs), p3: (draft().settings.latePenaltyPct) } }}</div></div>
              </div>
            </div>
          </div>
        }

        @if (tab() === 'payments') {
          <!-- TODO(remove with the real Firestore/auth wiring): the mock "Payout Accounts & Banking Settlement" bank card below
               is replaced by the Razorpay connection (bank + KYC live on Razorpay). Delete the card, openBank()/removeBank(),
               the bank modal and SalonSettings.bank when the mock stores are replaced. Tracked in docs/LAUNCH-CHECKLIST.md. -->
          <div [class]="card + ' lg:p-7 space-y-5'" data-testid="razorpay-card">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
              <div>
                <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[24px] text-primary">credit_score</span><h2 class="text-headline-md font-headline-md text-on-surface">{{ "Online Payments with Razorpay" | translate }}</h2></div>
                <p class="font-body-md text-body-md text-on-surface-variant mt-0.5">{{ "Connect your own Razorpay account. Customer payments settle directly into it; Chairly never holds your money." | translate }}</p>
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
                  <button type="button" (click)="rzp.disconnect()" [disabled]="rzp.busy()" class="px-4 py-2 rounded-xl border border-error/40 text-error hover:bg-error-container/40 font-label-md text-label-md font-semibold transition-colors disabled:opacity-60">{{ "Disconnect" | translate }}</button>
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
          </div>

          <div [class]="card + ' lg:p-7 space-y-6'">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
              <div><div class="flex items-center gap-2"><span class="material-symbols-outlined text-[24px] text-primary">account_balance_wallet</span><h2 class="text-headline-md font-headline-md text-on-surface">{{ "Payout Accounts & Banking Settlement" | translate }}</h2></div><p class="font-body-md text-body-md text-on-surface-variant mt-0.5">{{ "Customer payments go straight to your own bank account. Chairly never holds your money." | translate }}</p></div>
              <button type="button" (click)="openBank()" class="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-low font-label-md text-label-md transition-colors self-start sm:self-auto"><span class="material-symbols-outlined text-[18px]">add_card</span><span>{{ draft().settings.bank ? ('Change Bank Account' | translate) : ('Add Bank Account' | translate) }}</span></button>
            </div>
            <div class="grid grid-cols-1 gap-6">
              <div class="p-5 rounded-2xl bg-surface-bright border border-outline-variant/50 flex flex-col justify-between space-y-4">
                @if (draft().settings.bank; as bank) {
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <div class="flex items-center gap-3.5"><div class="w-12 h-12 rounded-xl bg-tertiary-fixed/30 border border-tertiary/20 flex items-center justify-center text-tertiary"><span class="material-symbols-outlined text-[28px]">verified_user</span></div><div><div class="flex items-center gap-2 flex-wrap"><span class="font-label-lg text-label-lg text-on-surface font-bold">{{ bank.bankName }}</span><span class="px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-tertiary/10 text-tertiary font-semibold">{{ "Connected" | translate }}</span></div><p class="font-body-sm text-body-sm text-on-surface-variant">{{ "Razorpay direct routing — activates when payments go live" | translate }}</p></div></div>
                    <div class="text-right"><span class="font-body-sm text-body-sm text-outline block">{{ "Frequency" | translate }}</span><span class="font-label-md text-label-md text-on-surface font-semibold">{{ "Daily Auto-Settlement" | translate }}</span></div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-body-sm">
                    <div><span class="text-outline block text-[11px] uppercase tracking-wider font-semibold">{{ "Account Number" | translate }}</span><span class="font-headline-sm text-headline-sm text-on-surface font-mono mt-0.5 block">•••• {{ bank.accountLast4 }}</span></div>
                    <div><span class="text-outline block text-[11px] uppercase tracking-wider font-semibold">{{ "IFSC Code" | translate }}</span><span class="font-label-md text-label-md text-on-surface font-mono mt-1 block">{{ bank.ifsc }}</span></div>
                    <div><span class="text-outline block text-[11px] uppercase tracking-wider font-semibold">{{ "Beneficiary Name" | translate }}</span><span class="font-label-md text-label-md text-on-surface mt-1 block truncate">{{ bank.beneficiary }}</span></div>
                  </div>
                  <div class="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant pt-2 border-t border-outline-variant/20"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-tertiary"></span><span>{{ "Next payout: {{p1}} tomorrow at 06:00 AM IST" | translate: { p1: (inr(nextPayout())) } }}</span></div><button type="button" (click)="removeBank()" class="text-error font-semibold hover:underline">{{ "Remove" | translate }}</button></div>
                } @else {
                  <div class="text-center py-8 text-on-surface-variant"><span class="material-symbols-outlined text-4xl text-primary/40">account_balance</span><p class="mt-2 font-label-lg text-label-lg text-on-surface">{{ "No bank account connected" | translate }}</p><p class="text-body-sm">{{ "Add one to receive online payments from customers." | translate }}</p></div>
                }
              </div>
            </div>
          </div>
        }
        <div class="h-8"></div>
      </div>
    </main>

    <app-modal [open]="holidayOpen()" [title]="'Add Holiday' | translate" (closed)="holidayOpen.set(false)">
      <form class="space-y-4" (ngSubmit)="saveHoliday()" #hf="ngForm">
        <div><label [class]="label" for="h-name">{{ "Holiday name" | translate }}</label><input id="h-name" name="name" [class]="input" [(ngModel)]="hName" required [placeholder]="'e.g., Diwali' | translate" /></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label [class]="label" for="h-date">{{ "Date" | translate }}</label><input id="h-date" name="date" type="date" [class]="input" [(ngModel)]="hDate" [min]="todayKey" required /></div>
          <div><label [class]="label" for="h-type">{{ "Closure" | translate }}</label><select id="h-type" name="type" [class]="input" [(ngModel)]="hType"><option value="full">{{ "Full day" | translate }}</option><option value="half">{{ "Half day" | translate }}</option></select></div>
        </div>
        @if (hType === 'half') { <div><label [class]="label" for="h-close">{{ "Closes at" | translate }}</label><input id="h-close" name="close" type="time" [class]="input" [(ngModel)]="hClose" required /></div> }
        <div class="flex justify-end gap-3 pt-4 border-t border-outline-variant/20"><button type="button" [class]="ghost" (click)="holidayOpen.set(false)">{{ "Cancel" | translate }}</button><button type="submit" [class]="primary" [disabled]="hf.invalid">{{ "Add holiday" | translate }}</button></div>
      </form>
    </app-modal>

    <app-modal [open]="bankOpen()" [title]="'Bank account' | translate" (closed)="bankOpen.set(false)">
      <form class="space-y-4" (ngSubmit)="saveBank()" #bf="ngForm">
        <div><label [class]="label" for="b-name">{{ "Bank name" | translate }}</label><input id="b-name" name="bank" [class]="input" [(ngModel)]="bBank" required [placeholder]="'e.g., HDFC Bank' | translate" /></div>
        <div><label [class]="label" for="b-ben">{{ "Beneficiary name" | translate }}</label><input id="b-ben" name="ben" [class]="input" [(ngModel)]="bBen" required /></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label [class]="label" for="b-acc">{{ "Account number" | translate }}</label><input id="b-acc" name="acc" inputmode="numeric" [class]="input" [(ngModel)]="bAcc" required minlength="9" maxlength="18" /></div>
          <div><label [class]="label" for="b-ifsc">{{ "IFSC code" | translate }}</label><input id="b-ifsc" name="ifsc" [class]="input + ' uppercase'" [(ngModel)]="bIfsc" required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" [placeholder]="'HDFC0000240' | translate" /></div>
        </div>
        <p class="text-body-sm text-outline">{{ "Only the last 4 digits are stored on Chairly. The full number is held by the payment provider." | translate }}</p>
        <div class="flex justify-end gap-3 pt-4 border-t border-outline-variant/20"><button type="button" [class]="ghost" (click)="bankOpen.set(false)">{{ "Cancel" | translate }}</button><button type="submit" [class]="primary" [disabled]="bf.invalid">{{ "Save account" | translate }}</button></div>
      </form>
    </app-modal>
  `,
})
export class OwnerSettings {
  protected readonly store = inject(SalonStore);
  protected readonly toast = inject(ToastService);
  private readonly lang = inject(LangService);
  private readonly admin = inject(AdminStore);
  protected readonly rzp = inject(PaymentConnectService);
  private readonly route = inject(ActivatedRoute);
  protected readonly connectedDate = computed(() => {
    const c = this.rzp.connectedAt();
    return c ? new Date(c).toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  });
  protected readonly inr = inr;
  protected readonly tabs = TABS;
  protected readonly buffers = [5, 10, 15, 20];
  protected readonly select = SELECT;
  protected readonly time = TIME;
  protected readonly card = CARD;
  protected readonly input = INPUT;
  protected readonly label = LABEL;
  protected readonly primary = BTN_PRIMARY;
  protected readonly ghost = BTN_GHOST;
  protected readonly todayKey = dateKey(new Date());

  protected readonly tab = signal<Tab>('general');

  constructor() {
    const flag = this.route.snapshot.queryParamMap.get('razorpay');
    if (flag) this.tab.set('payments');
    void this.rzp.load().then(() => this.rzp.handleReturn(flag));
  }
  protected readonly draft = signal<Draft>(this.snapshot());
  protected readonly holidayOpen = signal(false);
  protected readonly bankOpen = signal(false);
  protected hName = '';
  protected hDate = '';
  protected hType: 'full' | 'half' = 'full';
  protected hClose = '13:00';
  protected bBank = '';
  protected bBen = '';
  protected bAcc = '';
  protected bIfsc = '';

  protected readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.snapshot()));
  protected readonly gstinOk = computed(() => !this.draft().settings.gstRegistered || GSTIN_PATTERN.test(this.draft().settings.gstin));
  protected readonly breakMins = computed(() => toMin(this.draft().brk.end) - toMin(this.draft().brk.start));
  protected readonly trialDays = computed(() => this.admin.daysLeft(this.draft().settings.trialEndsAt));
  protected readonly planPrice = computed(() => this.admin.plans().find((p) => p.id === 'pro')?.price ?? 1999);
  protected readonly renewal = computed(() => new Date(this.draft().settings.trialEndsAt + 'T00:00').toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short', year: 'numeric' }));
  protected readonly nextPayout = computed(() => this.store.base.upi + this.store.queue().filter((q) => q.stage === 'done' && (q.payMethod === 'UPI' || q.payMethod === 'Card')).reduce((a, q) => a + q.price, 0));

  private snapshot(): Draft {
    return { settings: structuredClone(this.store.settings()), brk: { ...this.store.brk() }, buffer: this.store.buffer() };
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

  monthOf(h: Holiday) {
    return new Date(h.date + 'T00:00').toLocaleDateString(LOCALE(), { month: 'short' });
  }
  dayOf(h: Holiday) {
    return h.date.slice(8, 10);
  }

  openHoliday() {
    this.hName = '';
    this.hDate = '';
    this.hType = 'full';
    this.hClose = '13:00';
    this.holidayOpen.set(true);
  }
  saveHoliday() {
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

  openBank() {
    const b = this.draft().settings.bank;
    this.bBank = b?.bankName ?? '';
    this.bBen = b?.beneficiary ?? this.store.profile().name;
    this.bAcc = '';
    this.bIfsc = b?.ifsc ?? '';
    this.bankOpen.set(true);
  }
  saveBank() {
    const bank: BankAccount = { bankName: this.bBank.trim(), beneficiary: this.bBen.trim(), accountLast4: this.bAcc.replace(/\D/g, '').slice(-4), ifsc: this.bIfsc.trim().toUpperCase() };
    this.patch({ bank });
    this.bankOpen.set(false);
  }
  removeBank() {
    this.patch({ bank: null });
  }

  previewHindi() {
    this.lang.set('hi');
    this.toast.info('Language switched to Hindi. Toggle it again on any customer page.');
  }

  save() {
    if (!this.gstinOk()) return this.toast.error('Enter a valid GSTIN or turn off GST registered.');
    if (this.draft().brk.enabled && this.breakMins() <= 0) return this.toast.error('Break end must be after the break start.');
    const d = this.draft();
    this.store.settings.set(structuredClone(d.settings));
    this.store.brk.set({ ...d.brk });
    this.store.buffer.set(d.buffer);
    this.store.markSaved();
    this.toast.success('Settings saved');
  }

  discard() {
    this.draft.set(this.snapshot());
    this.toast.info('Changes discarded');
  }
}
