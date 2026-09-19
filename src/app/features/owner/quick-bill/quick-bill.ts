import { TranslatePipe } from '@ngx-translate/core';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toDataURL } from 'qrcode';
import { Bill, CatalogService, PayMethod } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { SalonStore, callableMessage } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { splitGst } from '../../../core/utils/gst';
import { inr, initials } from '../../../core/utils/time';
import { Topbar } from '../../../shared/layout/topbar';
import { Modal } from '../../../shared/ui/modal';

interface CartLine {
  serviceId: string;
  name: string;
  price: number;
  qty: number;
  duration: number;
  staffId: string;
}

const METHODS: { id: PayMethod; icon: string; label: string }[] = [
  { id: 'Cash', icon: 'payments', label: 'Cash' },
  { id: 'UPI', icon: 'qr_code_scanner', label: 'UPI' },
  { id: 'Card', icon: 'credit_card', label: 'Card' },
  { id: 'Split', icon: 'call_split', label: 'Split Bill' },
];
const SVC_ICONS: Record<string, string> = { Hair: 'content_cut', 'Beard & Shave': 'face', 'Facial & Skin': 'spa', 'Spa & Massage': 'self_improvement', Coloring: 'auto_fix_high' };

@Component({
  selector: 'app-quick-bill',
  imports: [FormsModule, RouterLink, Topbar, Modal, TranslatePipe],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-3 md:gap-4 min-w-0">
        <div class="flex items-center gap-2 text-muted font-body-md text-body-md whitespace-nowrap">
          <span class="hidden sm:inline">{{ "Checkout" | translate }}</span><span class="material-symbols-outlined text-[16px] hidden sm:inline">chevron_right</span>
          <span class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ "Quick Billing" | translate }}</span>
        </div>
        <div class="hidden md:block h-4 w-px bg-outline-variant/50"></div>
        <div class="hidden md:flex items-center gap-2 bg-surface-container px-2.5 py-1 rounded-full border border-outline-variant/40">
          <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span class="font-label-sm text-label-sm text-on-surface">{{ "Cashier:" | translate }} <strong>{{ auth.profile().name }}</strong></span>
        </div>
      </div>
      <ng-container right>
        <div class="relative hidden lg:block w-64">
          <span class="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-muted">search</span>
          <input type="text" class="w-full bg-surface-bright border border-outline-variant/40 rounded-lg pl-9 pr-3 py-1.5 font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" [placeholder]="'Search service...' | translate" [attr.aria-label]="'Search services' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <button type="button" class="w-9 h-9 hidden sm:flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors" [title]="'Help' | translate" (click)="toast.info('Tap a service to add it to the invoice')"><span class="material-symbols-outlined text-[20px]">help</span></button>
        <div class="flex items-center gap-2.5 pl-1">
          <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-label-md border border-primary/20">{{ initials(auth.profile().name) }}</div>
          <div class="hidden xl:flex flex-col text-left"><span class="font-label-md text-label-md leading-tight text-on-surface font-semibold">{{ auth.profile().name }}</span><span class="font-label-sm text-label-sm text-muted">{{ (auth.profile().title) | translate }}</span></div>
        </div>
      </ng-container>
    </app-topbar>

    <main class="lg:pl-64 pt-16 min-h-screen bg-background">
      <div class="p-4 md:p-6 flex flex-col xl:flex-row gap-6">
        <div class="flex-1 flex flex-col gap-5 min-w-0">
          <div class="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-level-1 flex flex-col gap-4">
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div class="md:col-span-5 flex flex-col gap-1.5">
                <label class="font-label-sm text-label-sm text-muted flex items-center justify-between" for="qb-client">
                  <span>{{ "Client Name" | translate }}</span>
                  @if (fromQueue()) { <span class="text-primary font-medium flex items-center gap-0.5 text-[11px]"><span class="material-symbols-outlined text-[14px]">verified</span> {{ "From queue" | translate }}</span> }
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-2.5 material-symbols-outlined text-[18px] text-muted">person</span>
                  <input id="qb-client" type="text" class="w-full bg-surface-bright border rounded-xl pl-9 pr-3 py-2 font-label-lg text-label-lg font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" [class]="attempted() && !client().trim() ? 'border-error' : 'border-outline-variant/40'" [placeholder]="'Walk-in client name' | translate" [ngModel]="client()" (ngModelChange)="client.set($event)" />
                </div>
              </div>
              <div class="md:col-span-4 flex flex-col gap-1.5">
                <label class="font-label-sm text-label-sm text-muted" for="qb-phone">{{ "Mobile Number" | translate }}</label>
                <div class="relative">
                  <span class="absolute left-3 top-2.5 material-symbols-outlined text-[18px] text-muted">phone_iphone</span>
                  <input id="qb-phone" type="tel" class="w-full bg-surface-bright border border-outline-variant/40 rounded-xl pl-9 pr-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-mono" placeholder="+91 98765 43210" [ngModel]="phone()" (ngModelChange)="phone.set($event)" />
                </div>
              </div>
              <div class="md:col-span-3 flex md:flex-col justify-between items-start md:items-end gap-1 pt-1">
                @if (knownCustomer(); as k) {
                  <span class="font-label-sm text-label-sm text-muted">{{ "Returning client" | translate }}</span>
                  <span class="text-body-sm text-primary font-medium">{{ "{{p1}} visits · {{p2}} spent" | translate: { p1: (k.visits), p2: (inr(k.totalSpent)) } }}</span>
                }
              </div>
            </div>
            <div class="h-px bg-outline-variant/20"></div>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px] text-primary">group</span><span class="font-label-md text-label-md font-semibold text-on-surface">{{ "Assign Primary Stylist:" | translate }}</span></div>
              <div class="flex flex-wrap items-center gap-2.5">
                @for (s of store.staff(); track s.id) {
                  <button type="button" (click)="staffId.set(s.id)" class="flex items-center gap-2 px-3 py-1.5 rounded-full font-label-md text-label-md transition-all border" [class]="staffId() === s.id ? 'bg-primary text-on-primary shadow-xs border-primary' : 'bg-surface-container hover:bg-surface-variant/50 text-on-surface border-outline-variant/30'">
                    <span class="w-2 h-2 rounded-full" [class]="staffId() === s.id ? 'bg-on-primary' : 'bg-muted/40'"></span>
                    <span>{{ s.name }}</span><span class="text-[10px] font-normal" [class]="staffId() === s.id ? 'opacity-80' : 'text-muted'">{{ (s.role) | translate }}</span>
                  </button>
                }
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between overflow-x-auto no-scrollbar pb-1 gap-2">
              <div class="flex items-center gap-2">
                @for (c of ['All'].concat(store.categories()); track c) {
                  <button type="button" (click)="category.set(c)" class="px-4 py-2 rounded-xl font-label-md text-label-md whitespace-nowrap transition-all" [class]="category() === c ? 'bg-primary text-on-primary font-semibold shadow-xs' : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/30'">{{ c | translate }}</button>
                }
              </div>
              <div class="hidden sm:flex items-center gap-1.5 text-muted font-label-sm text-label-sm pl-2 whitespace-nowrap"><span class="material-symbols-outlined text-[16px]">touch_app</span> {{ "Tap to add to invoice" | translate }}</div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (s of visible(); track s.id) {
                <div class="rounded-2xl p-4 relative flex flex-col justify-between min-h-44 transition-all group bg-surface-container-lowest" [class]="inCart(s) ? 'border-2 border-primary shadow-level-2' : 'border border-outline-variant/30 hover:border-primary/60 shadow-level-1 hover:shadow-level-2'">
                  @if (inCart(s)) { <div class="absolute top-3 right-3 bg-primary text-on-primary text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">check</span> {{ "Added" | translate }}</div> }
                  <div>
                    <div class="flex items-center gap-2 mb-2">
                      <span class="p-1.5 rounded-lg" [class]="inCart(s) ? 'bg-primary/10 text-primary' : 'bg-surface-container text-muted group-hover:text-primary transition-colors'"><span class="material-symbols-outlined text-[18px]">{{ icon(s) }}</span></span>
                      <span class="font-label-sm text-label-sm font-semibold" [class]="inCart(s) ? 'text-primary' : 'text-muted'">{{ s.category | translate }}</span>
                    </div>
                    <h3 class="font-headline-sm text-headline-sm text-on-surface leading-snug" [class]="inCart(s) ? 'font-bold' : 'font-semibold group-hover:text-primary transition-colors'">{{ s.name }}</h3>
                    <div class="flex items-center gap-1.5 text-muted font-body-sm text-body-sm mt-1"><span class="material-symbols-outlined text-[15px]">schedule</span><span>{{ "{{p1}} mins" | translate: { p1: (s.duration) } }}</span></div>
                  </div>
                  <div class="flex items-center justify-between pt-3 border-t border-outline-variant/20">
                    <span class="font-headline-sm text-headline-sm font-bold text-on-surface">{{ inr(s.price) }}</span>
                    <button type="button" (click)="add(s)" class="flex items-center gap-1 px-3 py-1.5 rounded-lg font-label-md text-label-md active:scale-95 transition-all" [class]="inCart(s) ? 'bg-primary text-on-primary shadow-xs' : 'border border-primary text-primary hover:bg-primary hover:text-on-primary'">
                      <span class="material-symbols-outlined text-[16px]">{{ inCart(s) ? 'done' : 'add' }}</span><span>{{ inCart(s) ? ('In Cart' | translate) : ('+ Add' | translate) }}</span>
                    </button>
                  </div>
                </div>
              } @empty {
                <p class="col-span-full text-center text-outline py-10">{{ "No services match your search." | translate }}</p>
              }
            </div>
          </div>
        </div>

        <div class="w-full xl:w-[420px] flex flex-col gap-4 shrink-0">
          <div class="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-level-2 flex flex-col gap-5 xl:sticky xl:top-20">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[22px]">receipt_long</span><span class="font-headline-sm text-headline-sm font-bold text-on-surface">{{ "Live Invoice Summary" | translate }}</span></div>
              <span class="bg-surface-container px-2.5 py-1 rounded text-[11px] font-mono font-semibold text-muted">{{ invoiceNo() }}</span>
            </div>

            <div class="flex flex-col gap-3.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
              @for (l of cart(); track l.serviceId) {
                <div class="flex items-start justify-between gap-2 p-3 rounded-xl bg-surface-bright border border-outline-variant/30">
                  <div class="flex flex-col gap-1 min-w-0">
                    <span class="font-label-md text-label-md font-semibold text-on-surface">{{ l.name }}</span>
                    <div class="flex items-center gap-2"><span class="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-medium"><span class="material-symbols-outlined text-[12px]">person</span> {{ first(l.staffId) }}</span>@if (l.duration) { <span class="text-muted text-[11px]">{{ l.duration }}m</span> }</div>
                  </div>
                  <div class="flex flex-col items-end gap-1.5 shrink-0">
                    <span class="font-label-lg text-label-lg font-bold text-on-surface">{{ inr(l.price * l.qty) }}</span>
                    <div class="flex items-center border border-outline-variant/40 rounded-lg bg-surface-container-lowest">
                      <button type="button" [attr.aria-label]="'Decrease quantity' | translate" class="w-6 h-6 flex items-center justify-center text-muted hover:text-on-surface text-xs" (click)="qty(l, -1)">-</button>
                      <span class="w-6 text-center text-xs font-semibold">{{ l.qty }}</span>
                      <button type="button" [attr.aria-label]="'Increase quantity' | translate" class="w-6 h-6 flex items-center justify-center text-muted hover:text-on-surface text-xs" (click)="qty(l, 1)">+</button>
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="text-center py-8 text-outline"><span class="material-symbols-outlined text-4xl text-primary/30">shopping_cart</span><p class="mt-1 text-body-sm">{{ "No services added yet" | translate }}</p></div>
              }
            </div>

            <div class="flex gap-2">
              <div class="relative flex-1">
                <span class="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-muted">confirmation_number</span>
                <input type="text" class="w-full uppercase bg-surface-bright border border-outline-variant/40 rounded-xl pl-9 pr-3 py-2 font-mono text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary" [placeholder]="'Coupon or Voucher Code' | translate" [attr.aria-label]="'Coupon code' | translate" [ngModel]="coupon()" (ngModelChange)="coupon.set($event)" [disabled]="applied() !== null" (keydown.enter)="applyCoupon()" />
              </div>
              <button type="button" (click)="applied() ? removeCoupon() : applyCoupon()" class="px-3.5 py-2 bg-surface-container hover:bg-surface-variant text-on-surface font-label-md text-label-md rounded-xl font-semibold border border-outline-variant/40 transition-colors">{{ applied() ? ('Remove' | translate) : ('Apply' | translate) }}</button>
            </div>

            <div class="flex flex-col gap-2 pt-3 border-t border-outline-variant/20 font-body-sm text-body-sm">
              <div class="flex justify-between text-muted"><span>{{ (count() === 1 ? "Subtotal ({{p1}} service)" : "Subtotal ({{p1}} services)") | translate: { p1: count() } }}</span><span class="font-medium text-on-surface">{{ inr(subtotal()) }}</span></div>
              @if (discount() > 0) {
                <div class="flex justify-between text-primary font-medium"><span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">sell</span> {{ "Coupon {{p1}}" | translate: { p1: (applied()!.code) } }}</span><span>-{{ inr(discount()) }}</span></div>
              }
              @if (split().gst > 0) {
                <div class="flex justify-between text-muted text-[12px]"><span>{{ "Taxable value" | translate }}</span><span>{{ inr(split().taxable) }}</span></div>
                <div class="flex justify-between text-muted text-[12px]"><span>{{ "CGST (9%)" | translate }}</span><span>{{ inr(split().cgst) }}</span></div>
                <div class="flex justify-between text-muted text-[12px]"><span>{{ "SGST (9%)" | translate }}</span><span>{{ inr(split().sgst) }}</span></div>
              }
              <div class="h-px bg-outline-variant/30 my-1"></div>
              <div class="flex justify-between items-baseline">
                <span class="font-headline-sm text-headline-sm font-bold text-on-surface">{{ "Grand Total" | translate }}</span>
                <div class="text-right"><span class="font-headline-lg text-headline-lg font-bold text-primary">{{ inr(total()) }}</span><span class="block text-[10px] text-muted">{{ store.settings().gstRegistered ? "Inclusive of GST" : "All prices are final" }}</span></div>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <span class="font-label-sm text-label-sm text-muted font-medium">{{ "Select Payment Method" | translate }}</span>
              <div class="grid grid-cols-4 gap-1.5 bg-surface-bright p-1 rounded-xl border border-outline-variant/30" role="radiogroup">
                @for (m of methods; track m.id) {
                  <button type="button" role="radio" [attr.aria-checked]="method() === m.id" (click)="method.set(m.id)" class="py-2 px-1 flex flex-col items-center gap-1 rounded-lg transition-all" [class]="method() === m.id ? 'bg-primary text-on-primary shadow-xs' : 'text-muted hover:text-on-surface hover:bg-surface-container'">
                    <span class="material-symbols-outlined text-[18px]">{{ m.icon }}</span><span class="text-[11px] font-semibold">{{ (m.label) | translate }}</span>
                  </button>
                }
              </div>
            </div>

            @if (method() === 'UPI' && total() > 0) {
              <div class="p-3 bg-surface-container-low rounded-xl border border-primary/20 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-16 h-16 bg-white p-1 rounded-lg border border-outline-variant/30 flex items-center justify-center shadow-xs shrink-0">
                    @if (upiQr() && vpa()) { <img [src]="upiQr()" [alt]="'UPI payment QR' | translate" class="w-full h-full" /> } @else { <span class="material-symbols-outlined text-[44px] text-outline">qr_code_2</span> }
                  </div>
                  @if (vpa()) {
                    <div class="flex flex-col min-w-0"><span class="font-label-md text-label-md font-bold text-on-surface">{{ "Scan & Pay {{p1}}" | translate: { p1: (inr(total())) } }}</span><span class="text-[11px] text-muted truncate">{{ vpa() }}</span></div>
                  } @else {
                    <div class="flex flex-col min-w-0"><span class="font-label-md text-label-md font-bold text-on-surface">{{ "Add your UPI ID to show a payment QR" | translate }}</span><a routerLink="/owner/settings" class="text-[11px] text-primary font-semibold hover:underline">{{ "Open Settings" | translate }}</a></div>
                  }
                </div>
              </div>
            }

            <div class="flex flex-col gap-2.5 pt-1">
              <button type="button" (click)="complete()" [disabled]="!cart().length || saving()" class="w-full bg-secondary-container hover:bg-[#ff6842] text-on-secondary-container py-3.5 px-4 rounded-xl font-label-lg text-label-lg font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100">
                <span class="material-symbols-outlined text-[20px]">check_circle</span><span>{{ "Generate & Complete Bill" | translate }}</span>
              </button>
              <div class="grid grid-cols-2 gap-2.5">
                <button type="button" (click)="print()" [disabled]="!cart().length" class="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-outline-variant hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors disabled:opacity-50"><span class="material-symbols-outlined text-[18px] text-muted">print</span><span>{{ "Print Receipt" | translate }}</span></button>
                <a [href]="cart().length ? whatsapp() : null" target="_blank" rel="noopener" (click)="!cart().length && $event.preventDefault()" class="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-[#22A06B]/40 bg-[#22A06B]/5 hover:bg-[#22A06B]/10 text-[#0F6B43] font-label-md text-label-md transition-colors" [class.opacity-50]="!cart().length"><span class="material-symbols-outlined text-[18px] text-[#22A06B]" style="font-variation-settings: 'FILL' 1;">chat</span><span>{{ "WhatsApp Invoice" | translate }}</span></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <app-modal [open]="receipt() !== null" [title]="'Bill generated' | translate" (closed)="receipt.set(null)">
      @if (receipt(); as r) {
        <div class="space-y-4">
          <div class="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800"><span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">check_circle</span><div><p class="font-label-lg text-label-lg">{{ "Paid via {{p1}}" | translate: { p1: (r.method) } }}</p><p class="text-body-sm">{{ "Invoice {{p1}}" | translate: { p1: (r.no) } }}</p></div></div>
          <div class="text-body-md space-y-1">
            @for (l of r.lines; track l.serviceId) { <div class="flex justify-between"><span>{{ l.name }} × {{ l.qty }}</span><span>{{ inr(l.price * l.qty) }}</span></div> }
            @if (r.discount) { <div class="flex justify-between text-primary pt-1 border-t border-outline-variant/20"><span>{{ "Coupon {{p1}}" | translate: { p1: (r.couponCode) } }}</span><span>-{{ inr(r.discount) }}</span></div> }
            @if (r.gstRegistered) {
              <div class="pt-1 border-t border-outline-variant/20 text-[12px] text-muted space-y-0.5">
                <div class="flex justify-between"><span>{{ "Taxable value" | translate }}</span><span>{{ inr(r.taxable) }}</span></div>
                <div class="flex justify-between"><span>{{ "CGST (9%)" | translate }}</span><span>{{ inr(r.cgst) }}</span></div>
                <div class="flex justify-between"><span>{{ "SGST (9%)" | translate }}</span><span>{{ inr(r.sgst) }}</span></div>
                @if (r.gstin) { <div class="flex justify-between"><span>{{ "GSTIN" | translate }}</span><span class="font-mono">{{ r.gstin }}</span></div> }
              </div>
            }
            <div class="flex justify-between font-headline-sm text-headline-sm pt-1 border-t border-outline-variant/20"><span>{{ "Total" | translate }}</span><span class="text-primary">{{ inr(r.total) }}</span></div>
          </div>
          <div class="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
            <button type="button" class="px-4 py-2 rounded-lg text-label-md font-label-md border border-outline-variant hover:bg-surface-container" (click)="print()">{{ "Print" | translate }}</button>
            <button type="button" class="px-5 py-2 rounded-lg text-label-md font-label-md bg-primary text-on-primary hover:bg-primary-container font-semibold" (click)="closeReceipt()">{{ "Done" | translate }}</button>
          </div>
        </div>
      }
    </app-modal>
  `,
})
export class QuickBill implements OnInit {
  protected readonly store = inject(SalonStore);
  protected readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly inr = inr;
  protected readonly initials = initials;
  protected readonly methods = METHODS;

  protected readonly client = signal('');
  protected readonly phone = signal('');
  protected readonly staffId = signal(this.store.staff()[0]?.id ?? '');
  protected readonly cart = signal<CartLine[]>([]);
  protected readonly category = signal('All');
  protected readonly search = signal('');
  protected readonly coupon = signal('');
  protected readonly applied = signal<{ code: string; label: string } | null>(null);
  protected readonly method = signal<PayMethod>('UPI');
  protected readonly attempted = signal(false);
  protected readonly fromQueue = signal(false);
  protected readonly receipt = signal<Bill | null>(null);
  protected readonly upiQr = signal('');
  private queueId: string | null = null;
  private bookingId: string | null = null;
  protected readonly saving = signal(false);

  protected readonly visible = computed(() => {
    const c = this.category();
    const q = this.search().trim().toLowerCase();
    return this.store.selectedServices().filter((s) => (c === 'All' || s.category === c) && (!q || s.name.toLowerCase().includes(q)));
  });
  protected readonly count = computed(() => this.cart().reduce((a, l) => a + l.qty, 0));
  protected readonly subtotal = computed(() => this.cart().reduce((a, l) => a + l.price * l.qty, 0));
  protected readonly discount = computed(() => {
    const a = this.applied();
    if (!a) return 0;
    const r = this.store.applyCoupon(a.code, this.subtotal());
    return r.ok ? r.discount : 0;
  });
  protected readonly total = computed(() => Math.max(0, this.subtotal() - this.discount()));
  protected readonly split = computed(() => splitGst(this.total(), this.store.settings().gstRegistered));
  protected readonly knownCustomer = computed(() => {
    const d = this.phone().replace(/\D/g, '').slice(-10);
    return d.length === 10 ? this.store.customers().find((c) => c.phone.replace(/\D/g, '').slice(-10) === d) : undefined;
  });
  protected readonly invoiceNo = computed(() => {
    this.store.bills();
    return this.store.nextInvoiceNo();
  });
  /** The salon's own UPI id from Settings. Empty until the owner adds it. */
  protected readonly vpa = computed(() => (this.store.settings().upiId ?? '').trim());

  constructor() {
    effect(() => {
      if (this.method() !== 'UPI' || this.total() <= 0 || !this.vpa()) return;
      const uri = `upi://pay?pa=${this.vpa()}&pn=${encodeURIComponent(this.store.profile().name)}&am=${this.total()}&cu=INR&tn=${encodeURIComponent(this.invoiceNo())}`;
      toDataURL(uri, { margin: 0, width: 160, color: { dark: '#121d21', light: '#ffffff' } }).then((u) => this.upiQr.set(u));
    });
  }

  ngOnInit() {
    this.queueId = this.route.snapshot.queryParamMap.get('queueId');
    const q = this.store.queue().find((x) => x.id === this.queueId);
    if (q && q.stage !== 'done') {
      this.fromQueue.set(true);
      this.client.set(q.client);
      this.phone.set(/\d/.test(q.phone) && !q.phone.includes('•') ? q.phone : '');
      if (q.staffId) this.staffId.set(q.staffId);
      this.cart.set([{ serviceId: 'queue:' + q.id, name: q.service, price: q.price, qty: 1, duration: q.duration, staffId: q.staffId ?? this.staffId() }]);
    } else {
      this.queueId = null;
      const b = this.store.bookings().find((x) => x.id === this.route.snapshot.queryParamMap.get('bookingId'));
      if (b && !b.billed) {
        this.bookingId = b.id;
        this.client.set(b.client);
        this.phone.set(b.customerPhone ?? '');
        this.staffId.set(b.staffId);
        this.cart.set(
          (b.services?.length ? b.services : [{ serviceId: undefined, name: b.serviceName, price: b.price, duration: b.duration }]).map((l, i) => ({
            serviceId: l.serviceId ?? 'booking:' + i, name: l.name, price: l.price, qty: 1, duration: l.duration, staffId: b.staffId,
          })),
        );
      }
    }
  }

  icon(s: CatalogService) {
    return SVC_ICONS[s.category] ?? 'content_cut';
  }
  inCart(s: CatalogService) {
    return this.cart().some((l) => l.serviceId === s.id);
  }
  first(id: string) {
    return this.store.staffById(id)?.name.split(' ')[0] ?? '—';
  }

  add(s: CatalogService) {
    if (this.inCart(s)) return this.qty(this.cart().find((l) => l.serviceId === s.id)!, 1);
    this.cart.update((l) => [...l, { serviceId: s.id, name: s.name, price: s.price, qty: 1, duration: s.duration, staffId: this.staffId() }]);
  }

  qty(line: CartLine, d: number) {
    this.cart.update((l) => l.map((x) => (x === line ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));
  }

  applyCoupon() {
    const code = this.coupon().trim().toUpperCase();
    if (!code) return;
    const r = this.store.applyCoupon(code, this.subtotal());
    if (!r.ok) return this.toast.error('Invalid coupon code');
    this.applied.set({ code, label: r.label });
    this.toast.success('{{p1}} applied', { p1: r.label });
  }

  removeCoupon() {
    this.applied.set(null);
    this.coupon.set('');
  }

  private billInput() {
    return {
      client: this.client().trim(), phone: this.phone().trim(),
      lines: this.cart().map((l) => ({ serviceId: l.serviceId, name: l.name, price: l.price, qty: l.qty, staffId: l.staffId })),
      discount: this.discount(), couponCode: this.applied()?.code, method: this.method(), queueId: this.queueId, bookingId: this.bookingId,
    };
  }

  async complete() {
    this.attempted.set(true);
    if (!this.cart().length) return this.toast.error('Add at least one service.');
    if (!this.client().trim()) return this.toast.error('Enter the client name.');
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const bill = await this.store.createBill(this.billInput());
      this.receipt.set(bill);
      this.toast.success('Bill {{p1}} · {{p2}} paid via {{p3}}', { p1: bill.no, p2: inr(bill.total), p3: bill.method });
    } catch (e) {
      this.toast.error(callableMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  closeReceipt() {
    this.receipt.set(null);
    const fromQueue = this.queueId !== null;
    this.cart.set([]);
    this.client.set('');
    this.phone.set('');
    this.coupon.set('');
    this.applied.set(null);
    this.attempted.set(false);
    this.fromQueue.set(false);
    this.queueId = null;
    this.bookingId = null;
    if (fromQueue) this.router.navigateByUrl('/owner/dashboard');
  }

  whatsapp() {
    const lines = this.cart().map((l) => `${l.name} x${l.qty} - ${inr(l.price * l.qty)}`).join('\n');
    const text = `${this.store.profile().name}\nInvoice ${this.invoiceNo()}\n${lines}\nTotal: ${inr(this.total())}${this.store.settings().gstRegistered ? ' (incl. GST)' : ''}\nThank you!`;
    const digits = this.phone().replace(/\D/g, '');
    return `https://wa.me/${digits.length >= 10 ? '91' + digits.slice(-10) : ''}?text=${encodeURIComponent(text)}`;
  }

  print() {
    window.print();
  }
}
