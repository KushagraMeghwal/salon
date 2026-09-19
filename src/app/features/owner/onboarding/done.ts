import { TranslatePipe } from '@ngx-translate/core';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toDataURL } from 'qrcode';
import { environment } from '../../../../environments/environment';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { fmt12Str } from '../../../core/utils/time';
import { SalonMark } from '../../../shared/layout/salon-mark';
import { WizardHeader } from '../../../shared/layout/wizard-header';

@Component({
  selector: 'app-setup-done',
  imports: [RouterLink, WizardHeader, SalonMark, TranslatePipe],
  template: `
    <div class="min-h-screen flex flex-col bg-background text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      <app-wizard-header [active]="4" [complete]="true" />

      <main class="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-10 flex flex-col items-center">
        <div class="w-full max-w-3xl text-center mb-8 relative">
          <div class="absolute -top-3 left-10 text-xl select-none animate-bounce no-print">✨</div>
          <div class="absolute -top-1 right-12 text-xl select-none animate-pulse no-print">🎊</div>
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary mb-4 shadow-sm">
            <span class="material-symbols-outlined text-[18px] text-primary" style="font-variation-settings: 'FILL' 1;">check_circle</span>
            <span class="text-label-md font-label-md font-semibold tracking-wide">{{ "🎉 Congratulations! Your salon is officially live." | translate }}</span>
          </div>
          <h1 class="text-headline-xl-mobile md:text-headline-xl font-headline-xl text-on-surface tracking-tight mb-2">{{ "Welcome to your new digital salon front" | translate }}</h1>
          <p class="text-body-md font-body-md text-muted max-w-xl mx-auto">{{ "Your booking profile, schedule, and team slots are published to the web. Start accepting instant client bookings today." | translate }}</p>
        </div>

        <div class="w-full max-w-5xl bg-surface-container-lowest rounded-2xl p-6 md:p-7 border border-outline-variant/30 shadow-level-1 mb-8 relative overflow-hidden">
          <div class="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div class="flex items-center gap-5 min-w-0">
              <app-salon-mark size="lg" />
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2.5 mb-1">
                  <h2 class="text-headline-md font-headline-md text-on-surface">{{ store.profile().name }}</h2>
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-emerald-100 text-emerald-800 font-semibold">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> {{ "ACTIVE" | translate }}
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm font-body-sm text-muted">
                  <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-primary">location_on</span> {{ area() }}</span>
                  <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-primary">phone</span> +91 {{ store.profile().phone }}</span>
                  <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-primary">schedule</span> {{ hoursLabel() }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-outline-variant/20">
              <div class="flex gap-2">
                <span class="px-3 py-1 bg-surface-container rounded-lg text-label-md font-label-md text-on-surface-variant font-medium">{{ "{{p1}} Stylists" | translate: { p1: (store.staff().length) } }}</span>
                <span class="px-3 py-1 bg-surface-container rounded-lg text-label-md font-label-md text-on-surface-variant font-medium">{{ "{{p1}} Services" | translate: { p1: (store.selectedServices().length) } }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
          <div class="md:col-span-5 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-level-1 flex flex-col justify-between hover:shadow-level-2 transition-all duration-200">
            <div>
              <div class="flex items-center justify-between mb-4">
                <span class="inline-flex items-center gap-1.5 text-label-sm font-label-sm font-semibold tracking-wider text-primary uppercase"><span class="material-symbols-outlined text-[16px]">qr_code_scanner</span> {{ "Reception Asset" | translate }}</span>
                <span class="px-2 py-0.5 rounded text-label-sm font-label-sm bg-primary/10 text-primary font-medium">{{ "Instant Booking" | translate }}</span>
              </div>
              <h3 class="text-headline-sm font-headline-sm text-on-surface mb-1">{{ "Salon QR Code Kit" | translate }}</h3>
              <p class="text-body-sm font-body-sm text-muted mb-5">{{ "Scan to Book Appointment Directly. Place at checkout counters, mirrors, and waiting areas." | translate }}</p>
              <div class="p-5 bg-surface-container-low rounded-xl border border-outline-variant/30 flex flex-col items-center justify-center">
                <div class="relative bg-surface-container-lowest p-3.5 rounded-lg shadow-sm border border-outline-variant/20 flex items-center justify-center">
                  @if (qr()) {
                    <img [src]="qr()" [alt]="'Booking QR code' | translate" class="w-44 h-44" />
                    <div class="absolute inset-0 m-auto w-11 h-11 bg-surface-container-lowest rounded-lg p-1 shadow-md flex items-center justify-center ring-2 ring-primary/20"><app-salon-mark size="sm" /></div>
                  } @else {
                    <div class="w-44 h-44 rounded bg-surface-container animate-pulse"></div>
                  }
                </div>
                <span class="mt-3 text-label-sm font-label-sm text-muted flex items-center gap-1 justify-center"><span class="material-symbols-outlined text-[14px]">smartphone</span> {{ "Point camera to view interactive menu" | translate }}</span>
              </div>
            </div>
            <div class="mt-5 space-y-2 no-print">
              <a [href]="qr()" download="salon-booking-qr.png" class="w-full py-2 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface text-label-md font-label-md rounded-lg flex items-center justify-center gap-2 transition-colors duration-150 font-medium active:scale-[0.99]">
                <span class="material-symbols-outlined text-[18px] text-primary">download</span><span>{{ "Download QR (PNG)" | translate }}</span>
              </a>
              <button type="button" (click)="print()" class="w-full py-2 px-3 bg-transparent hover:bg-surface-container-low text-muted hover:text-on-surface text-label-md font-label-md rounded-lg flex items-center justify-center gap-2 border border-outline-variant/30 transition-colors duration-150 active:scale-[0.99]">
                <span class="material-symbols-outlined text-[18px]">print</span><span>{{ "Print Table Standee" | translate }}</span>
              </button>
            </div>
          </div>

          <div class="md:col-span-7 flex flex-col gap-6">
            <div class="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-level-1 hover:shadow-level-2 transition-all duration-200">
              <div class="flex items-center justify-between mb-3">
                <span class="inline-flex items-center gap-1.5 text-label-sm font-label-sm font-semibold tracking-wider text-primary uppercase"><span class="material-symbols-outlined text-[16px]">link</span> {{ "Online Booking Link" | translate }}</span>
                <span class="text-label-sm font-label-sm text-muted hidden sm:inline">{{ "SSL Secured & Mobile Optimized" | translate }}</span>
              </div>
              <h3 class="text-headline-sm font-headline-sm text-on-surface mb-1">{{ "Your Dedicated Booking Web Address" | translate }}</h3>
              <p class="text-body-sm font-body-sm text-muted mb-4">{{ "Share this link in your Instagram bio, Google Business Profile, and SMS notifications." | translate }}</p>
              <div class="flex items-center gap-2 p-1.5 bg-surface-container-low rounded-xl border border-outline-variant/40 focus-within:ring-2 focus-within:ring-primary mb-4 transition-all">
                <div class="pl-3 text-muted flex items-center"><span class="material-symbols-outlined text-[18px]">globe</span></div>
                <input class="flex-1 min-w-0 bg-transparent border-0 text-body-md font-body-md text-on-surface focus:ring-0 focus:outline-none px-2 py-1 font-mono select-all" readonly type="text" [attr.aria-label]="'Booking link' | translate" [value]="link()" />
                <button type="button" (click)="copy()" class="px-4 py-2 text-on-primary rounded-lg text-label-md font-label-md font-semibold transition-all duration-150 flex items-center gap-1.5 active:scale-95 shadow-sm" [class]="copied() ? 'bg-emerald-600' : 'bg-primary hover:bg-primary-container'">
                  <span class="material-symbols-outlined text-[16px]">{{ copied() ? 'check' : 'content_copy' }}</span><span>{{ copied() ? ('Copied!' | translate) : ('Copy Link' | translate) }}</span>
                </button>
              </div>
              <div>
                <div class="text-label-sm font-label-sm text-muted mb-3 font-medium">{{ "Quick share to customer channels:" | translate }}</div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <a class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-outline-variant/30 hover:border-primary hover:bg-primary/5 transition-all text-on-surface group" [href]="whatsapp()" target="_blank" rel="noopener"><span class="material-symbols-outlined text-[18px] text-emerald-600 group-hover:scale-110 transition-transform">chat</span><span class="text-label-md font-label-md font-medium">{{ "WhatsApp" | translate }}</span></a>
                  <button type="button" (click)="copyFor('Instagram')" class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-outline-variant/30 hover:border-primary hover:bg-primary/5 transition-all text-on-surface group"><span class="material-symbols-outlined text-[18px] text-pink-600 group-hover:scale-110 transition-transform">photo_camera</span><span class="text-label-md font-label-md font-medium">{{ "Instagram" | translate }}</span></button>
                  <a class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-outline-variant/30 hover:border-primary hover:bg-primary/5 transition-all text-on-surface group" [href]="sms()"><span class="material-symbols-outlined text-[18px] text-primary group-hover:scale-110 transition-transform">sms</span><span class="text-label-md font-label-md font-medium">{{ "SMS Blast" | translate }}</span></a>
                  <a class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-outline-variant/30 hover:border-primary hover:bg-primary/5 transition-all text-on-surface group" [href]="facebook()" target="_blank" rel="noopener"><span class="material-symbols-outlined text-[18px] text-blue-600 group-hover:scale-110 transition-transform">share</span><span class="text-label-md font-label-md font-medium">{{ "Facebook" | translate }}</span></a>
                </div>
              </div>
            </div>

            <div class="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-level-1">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[20px]">checklist</span> {{ "What happens next?" | translate }}</h3>
                <span class="text-label-sm font-label-sm text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded">{{ "3 Quick Steps" | translate }}</span>
              </div>
              <div class="space-y-3.5">
                @for (n of next; track n.title; let i = $index) {
                  <div class="flex items-start gap-3.5 p-2.5 rounded-xl hover:bg-surface-container-low transition-colors">
                    <div class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-label-md font-label-md font-bold shrink-0 mt-0.5">{{ i + 1 }}</div>
                    <div class="flex-1">
                      <div class="text-body-md font-body-md font-semibold text-on-surface">{{ (n.title) | translate }}</div>
                      <div class="text-body-sm font-body-sm text-muted">{{ (n.text) | translate }}</div>
                    </div>
                    <span class="material-symbols-outlined text-outline-variant text-[18px]">{{ n.icon }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>

        <div class="w-full max-w-5xl bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-level-1 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
          <div class="flex items-center gap-2 text-muted text-body-sm font-body-sm"><span class="material-symbols-outlined text-primary text-[18px]">verified_user</span><span>{{ "Need adjustments? You can modify services, stylists, and working hours anytime." | translate }}</span></div>
          <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <button type="button" (click)="preview()" class="w-full sm:w-auto px-5 py-2.5 rounded-xl border-[1.5px] border-primary text-primary hover:bg-primary/5 text-label-lg font-label-lg transition-all duration-150 text-center font-medium flex items-center justify-center gap-2 active:scale-[0.99]"><span class="material-symbols-outlined text-[18px]">visibility</span><span>{{ "Preview Client Booking Page" | translate }}</span></button>
            <a routerLink="/owner/dashboard" class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-label-lg font-label-lg font-semibold shadow-md hover:shadow-lg transition-all duration-150 text-center flex items-center justify-center gap-2 active:scale-[0.99]"><span>{{ "Go to Salon Dashboard & Calendar" | translate }}</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span></a>
          </div>
        </div>
      </main>

      <footer class="w-full border-t border-outline-variant/20 py-4 px-8 mt-auto bg-surface-container-lowest/60 text-center text-body-sm font-body-sm text-muted">
        {{ "Powered by" | translate }} <span class="font-semibold text-primary">{{ "Chairly" | translate }}</span>
      </footer>
    </div>
  `,
})
export class SetupDone implements OnInit {
  protected readonly store = inject(SalonStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly qr = signal('');
  protected readonly copied = signal(false);
  protected readonly link = computed(() => `${environment.publicBaseUrl}/s/${this.store.profile().slug}`);
  protected readonly area = computed(() => [this.store.profile().landmark.split(',').pop()?.trim(), this.store.profile().city].filter(Boolean).join(', '));
  protected readonly hoursLabel = computed(() => {
    const open = this.store.timings().filter((t) => t.open);
    if (!open.length) return 'Closed';
    const s = open.map((t) => t.start).sort()[0];
    const e = open.map((t) => t.end).sort().reverse()[0];
    return `${fmt12Str(s)} - ${fmt12Str(e)}`;
  });
  protected readonly whatsapp = computed(() => `https://wa.me/?text=${encodeURIComponent(`Book your appointment at ${this.store.profile().name}: ${this.link()}`)}`);
  protected readonly sms = computed(() => `sms:?body=${encodeURIComponent(`Book at ${this.store.profile().name}: ${this.link()}`)}`);
  protected readonly facebook = computed(() => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.link())}`);

  protected readonly next = [
    { title: 'Download the Chairly Partner app on Android / iOS', text: 'Manage stylist rosters, check-in walk-ins, and view daily sales from your phone.', icon: 'install_mobile' },
    { title: 'Receive real-time client booking alerts & WhatsApp confirmations', text: 'Automated reminders reduce no-shows and notify allocated stylists instantly.', icon: 'notifications_active' },
    { title: 'Generate instant split billing & invoices at checkout', text: 'One-tap billing with GST breakdown, stylist commission logs, and payment receipts.', icon: 'receipt_long' },
  ];

  async ngOnInit() {
    if (!this.store.onboarded()) {
      this.router.navigateByUrl('/owner/onboarding/salon');
      return;
    }
    this.qr.set(await toDataURL(this.link(), { margin: 1, width: 400, errorCorrectionLevel: 'H', color: { dark: '#00685b', light: '#ffffff' } }));
  }

  async copy() {
    await this.writeClipboard();
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2400);
  }

  async copyFor(channel: string) {
    await this.writeClipboard();
    this.toast.success('Link copied. Paste it in your {{p1}} bio.', { p1: channel });
  }

  private async writeClipboard() {
    try {
      await navigator.clipboard.writeText(this.link());
    } catch {
      this.toast.error('Could not access the clipboard.');
    }
  }

  print() {
    window.print();
  }

  preview() {
    this.toast.info('The customer booking page arrives with the customer panel.');
  }
}
