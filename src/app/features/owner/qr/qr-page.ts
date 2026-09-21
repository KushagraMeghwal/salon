import { TranslatePipe } from '@ngx-translate/core';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toDataURL } from 'qrcode';
import { environment } from '../../../../environments/environment';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { Topbar } from '../../../shared/layout/topbar';

/** Owner "QR & Share": the salon's booking link as a QR code plus every way to hand it to customers. */
@Component({
  selector: 'app-qr-page',
  imports: [Topbar, TranslatePipe],
  template: `
    <app-topbar>
      <div left class="flex items-center gap-2 min-w-0"><span class="material-symbols-outlined text-primary">qr_code_2</span><span class="font-headline-sm text-headline-sm font-bold text-on-surface truncate">{{ "QR & Share" | translate }}</span></div>
    </app-topbar>

    <main class="lg:pl-64 pt-16 min-h-screen bg-surface">
      <div class="max-w-5xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        @if (!store.bookable()) {
          <div class="lg:col-span-2 print:hidden rounded-xl border border-outline-variant bg-secondary-fixed/40 p-4 text-body-md flex gap-2"><span class="material-symbols-outlined text-secondary">info</span><span>{{ "Customers cannot book yet. Finish setup or check your subscription in Settings." | translate }}</span></div>
        }

        <!-- The standee: this is what gets printed. -->
        <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-level-1 p-6 flex flex-col items-center text-center gap-3">
          @if (store.profile().logo; as logo) { <img [src]="logo" [alt]="store.profile().name" class="w-16 h-16 object-contain rounded-xl" /> }
          <h1 class="text-headline-md font-headline-md font-bold text-on-surface">{{ store.profile().name }}</h1>
          <p class="text-body-md text-on-surface-variant">{{ "Scan to book your appointment" | translate }}</p>
          <div class="w-64 max-w-full aspect-square bg-white p-3 rounded-2xl border border-outline-variant flex items-center justify-center">
            @if (qr()) { <img [src]="qr()" [alt]="'Booking QR code' | translate" class="w-full h-full" /> } @else { <span class="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></span> }
          </div>
          <p class="text-label-md font-mono text-primary break-all">{{ display() }}</p>
          <p class="text-label-sm text-outline">{{ "Powered by" | translate }} <span class="font-semibold text-primary">{{ "Chairly" | translate }}</span></p>
        </section>

        <section class="print:hidden flex flex-col gap-4">
          <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-level-1 p-5 space-y-3">
            <h2 class="text-headline-sm font-headline-sm font-bold">{{ "Your booking link" | translate }}</h2>
            <div class="flex items-center gap-2 bg-surface-container-low rounded-xl border border-outline-variant/40 p-2">
              <span class="flex-1 min-w-0 truncate px-2 text-body-md font-mono">{{ link() }}</span>
              <button type="button" (click)="copy()" class="shrink-0 px-3 py-2 rounded-lg bg-primary text-on-primary font-label-md font-semibold active:scale-95 flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">{{ copied() ? 'check' : 'content_copy' }}</span>{{ (copied() ? 'Copied' : 'Copy') | translate }}</button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <a [href]="link()" target="_blank" rel="noopener" class="py-2.5 rounded-xl border border-primary text-primary font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/5"><span class="material-symbols-outlined text-[18px]">open_in_new</span>{{ "Open booking page" | translate }}</a>
              @if (canShare) { <button type="button" (click)="nativeShare()" class="py-2.5 rounded-xl border border-outline-variant font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-low"><span class="material-symbols-outlined text-[18px]">ios_share</span>{{ "Share" | translate }}</button> }
            </div>
          </div>

          <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-level-1 p-5 space-y-3">
            <h2 class="text-headline-sm font-headline-sm font-bold">{{ "Send to customers" | translate }}</h2>
            <div class="grid grid-cols-2 gap-2">
              <a [href]="whatsapp()" target="_blank" rel="noopener" class="py-2.5 rounded-xl bg-[#25D366]/10 text-[#128C4B] font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-[#25D366]/20"><span class="material-symbols-outlined text-[18px]">chat</span>WhatsApp</a>
              <a [href]="sms()" class="py-2.5 rounded-xl bg-surface-container font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-high"><span class="material-symbols-outlined text-[18px]">sms</span>SMS</a>
              <a [href]="email()" class="py-2.5 rounded-xl bg-surface-container font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-high"><span class="material-symbols-outlined text-[18px]">mail</span>Email</a>
              <a [href]="facebook()" target="_blank" rel="noopener" class="py-2.5 rounded-xl bg-[#1877F2]/10 text-[#1877F2] font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-[#1877F2]/20"><span class="material-symbols-outlined text-[18px]">groups</span>Facebook</a>
            </div>
            <button type="button" (click)="copy()" class="w-full py-2.5 rounded-xl border border-outline-variant font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-low"><span class="material-symbols-outlined text-[18px]">link</span>{{ "Copy link for Instagram bio" | translate }}</button>
          </div>

          <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-level-1 p-5 space-y-3">
            <h2 class="text-headline-sm font-headline-sm font-bold">{{ "Download & print" | translate }}</h2>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" (click)="download('png')" class="py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-semibold flex items-center justify-center gap-1.5 active:scale-95"><span class="material-symbols-outlined text-[18px]">download</span>PNG</button>
              <button type="button" (click)="download('svg')" class="py-2.5 rounded-xl border border-primary text-primary font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/5"><span class="material-symbols-outlined text-[18px]">download</span>SVG</button>
            </div>
            <button type="button" (click)="print()" class="w-full py-2.5 rounded-xl border border-outline-variant font-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-low"><span class="material-symbols-outlined text-[18px]">print</span>{{ "Print table standee" | translate }}</button>
          </div>
        </section>
      </div>
    </main>
  `,
})
export class QrPage implements OnInit {
  protected readonly store = inject(SalonStore);
  private readonly toast = inject(ToastService);

  protected readonly qr = signal('');
  protected readonly copied = signal(false);
  protected readonly canShare = typeof navigator !== 'undefined' && !!navigator.share;
  protected readonly link = computed(() => `${environment.publicBaseUrl}/s/${this.store.profile().slug}`);
  protected readonly display = computed(() => this.link().replace(/^https?:\/\//, ''));
  private readonly text = computed(() => `Book your appointment at ${this.store.profile().name}: ${this.link()}`);
  protected readonly whatsapp = computed(() => `https://wa.me/?text=${encodeURIComponent(this.text())}`);
  protected readonly sms = computed(() => `sms:?&body=${encodeURIComponent(this.text())}`);
  protected readonly email = computed(() => `mailto:?subject=${encodeURIComponent('Book at ' + this.store.profile().name)}&body=${encodeURIComponent(this.text())}`);
  protected readonly facebook = computed(() => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.link())}`);

  constructor() {
    effect(() => {
      const url = this.link();
      if (this.store.profile().slug) void toDataURL(url, { margin: 1, width: 720, errorCorrectionLevel: 'H', color: { dark: '#00685b', light: '#ffffff' } }).then((d) => this.qr.set(d));
    });
  }

  ngOnInit() {
    if (!this.store.profile().slug) this.toast.info('Finish setup to get your booking link.');
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.link());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2200);
    } catch {
      this.toast.error('Could not access the clipboard.');
    }
  }

  async nativeShare() {
    try {
      await navigator.share({ title: this.store.profile().name, text: this.text(), url: this.link() });
    } catch {
      /* cancelled */
    }
  }

  async download(kind: 'png' | 'svg') {
    const name = `${this.store.profile().slug || 'booking'}-qr.${kind}`;
    const href = kind === 'png' ? this.qr() : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(await (await import('qrcode')).toString(this.link(), { type: 'svg', margin: 1, color: { dark: '#00685b', light: '#ffffff' } }));
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    this.toast.success('QR code downloaded');
  }

  print() {
    window.print();
  }
}
