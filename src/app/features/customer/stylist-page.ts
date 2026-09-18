import { Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AvailabilityService } from '../../core/services/availability.service';
import { BookingFlowStore } from '../../core/services/booking-flow.store';
import { SalonStore } from '../../core/services/salon.store';
import { fmt12, initials, toMin } from '../../core/utils/time';
import { StepBar } from '../../shared/customer/step-bar';

@Component({
  selector: 'app-customer-stylist',
  imports: [StepBar, TranslatePipe],
  template: `
    <main class="flex-1 w-full max-w-screen-md mx-auto px-space-md pt-space-md pb-32 space-y-space-md">
      <app-step-bar [step]="3" />

      <section (click)="flow.staffId.set('any')" class="cursor-pointer group">
        <div class="relative bg-surface-container-lowest rounded-xl p-space-md transition-all duration-200 elevation-1 hover:elevation-2" [class]="flow.staffId() === 'any' ? 'border-2 border-primary' : 'border-2 border-dashed border-outline-variant hover:border-primary'">
          <div class="flex items-start justify-between gap-space-md">
            <div class="flex items-start gap-space-md">
              <div class="w-12 h-12 rounded-xl bg-secondary-fixed/50 flex items-center justify-center text-secondary shrink-0"><span class="material-symbols-outlined text-[28px]">electric_bolt</span></div>
              <div>
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <h2 class="font-headline-sm text-headline-sm text-on-surface">{{ 'stylist.any' | translate }}</h2>
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm"><span class="material-symbols-outlined text-[13px]">verified</span> {{ 'stylist.recommended' | translate }}</span>
                </div>
                <p class="font-body-md text-body-md text-on-surface-variant flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-primary">schedule</span> {{ 'stylist.anySub' | translate }}</p>
              </div>
            </div>
            <div class="pt-1">
              @if (flow.staffId() === 'any') { <div class="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center"><span class="material-symbols-outlined text-[16px]">check</span></div> }
              @else { <div class="w-5 h-5 rounded-full border-2 border-outline group-hover:border-primary"></div> }
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-space-sm pt-space-xs">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-tertiary"></span><h3 class="font-headline-sm text-headline-sm text-on-surface">Available for {{ slotLabel() }}</h3></div>
          <span class="font-label-sm text-label-sm text-tertiary bg-tertiary-fixed/30 px-2 py-0.5 rounded-full whitespace-nowrap">{{ free().length }} {{ free().length === 1 ? 'Stylist' : 'Stylists' }} Ready</span>
        </div>

        @for (m of free(); track m.id) {
          <div (click)="flow.staffId.set(m.id)" class="bg-surface-container-lowest rounded-xl p-space-md transition-all cursor-pointer" [class]="flow.staffId() === m.id ? 'border-2 border-primary elevation-2' : 'border border-outline-variant/50 hover:border-primary/50 elevation-1 hover:elevation-2'">
            <div class="flex items-start justify-between gap-space-sm">
              <div class="flex items-start gap-space-md min-w-0">
                <div class="relative shrink-0">
                  @if (m.photo) { <img class="w-14 h-14 rounded-full object-cover border border-outline-variant/40" [src]="m.photo" [alt]="m.name" /> }
                  @else { <div class="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-sm text-headline-sm border-2" [class]="flow.staffId() === m.id ? 'border-primary' : 'border-transparent'">{{ initials(m.name) }}</div> }
                  <span class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-tertiary border-2 border-surface-container-lowest rounded-full"></span>
                </div>
                <div class="space-y-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap"><h4 class="font-headline-sm text-headline-sm text-on-surface">{{ m.name }}</h4><span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">Free at your slot</span></div>
                  <p class="font-body-md text-body-md text-on-surface-variant">{{ m.title || m.role }}</p>
                  <div class="flex items-center gap-3 pt-0.5 flex-wrap">
                    @if (rating(m.id); as r) { <div class="flex items-center gap-1 text-on-surface"><span class="material-symbols-outlined text-[16px] text-[#FFB400]" style="font-variation-settings: 'FILL' 1;">star</span><span class="font-label-md text-label-md font-bold">{{ r.rating }}</span><span class="font-body-sm text-body-sm text-outline">({{ r.reviews }} reviews)</span></div><span class="text-outline-variant">•</span> }
                    <span class="px-2 py-0.5 bg-surface-container-low text-on-surface-variant rounded-md font-label-sm text-label-sm">{{ specialty(m.id) }}</span>
                  </div>
                </div>
              </div>
              @if (flow.staffId() === m.id) { <div class="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[16px]">check</span></div> }
              @else { <div class="w-5 h-5 rounded-full border-2 border-outline shrink-0 mt-1"></div> }
            </div>

            @if (flow.staffId() === m.id) {
              <div class="mt-space-md pt-space-sm border-t border-outline-variant/40">
                <div class="flex items-center justify-between mb-2"><div class="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant"><span class="material-symbols-outlined text-[15px] text-primary">calendar_clock</span><span>{{ m.name.split(' ')[0] }}'s Day Schedule Timeline</span></div></div>
                <div class="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-2 bg-surface-container-low/60 rounded-xl border border-outline-variant/30">
                  @for (t of timeline(m.id); track t.key) {
                    @if (t.kind === 'mine') {
                      <div class="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-primary text-on-primary ring-2 ring-primary/40 shadow-sm"><span class="font-label-sm text-label-sm font-bold">{{ fmt(t.start) }}</span><span class="font-label-sm text-[10px] font-bold tracking-wide uppercase">Your Slot</span></div>
                    } @else if (t.kind === 'break') {
                      <div class="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-surface-container-high/40 border border-outline-variant/30"><span class="font-label-sm text-label-sm text-outline">{{ fmt(t.start) }}</span><span class="font-label-sm text-[10px] text-outline font-medium">Break</span></div>
                    } @else {
                      <div class="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-surface-container-high/60 border border-outline-variant/40"><span class="font-label-sm text-label-sm text-outline">{{ fmt(t.start) }}</span><span class="font-label-sm text-[10px] text-error font-medium flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-error"></span> Busy</span></div>
                    }
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>

      @if (busy().length) {
        <section class="mt-space-lg">
          <div class="bg-surface-container/70 border border-outline-variant/40 rounded-xl p-space-md space-y-space-sm">
            <div class="flex items-center justify-between pb-1"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-outline text-[18px]">timelapse</span><h3 class="font-headline-sm text-headline-sm text-on-surface-variant">{{ 'stylist.unavailable' | translate }}</h3></div></div>
            @for (b of busy(); track b.member.id) {
              <div class="bg-surface-container-lowest/80 border border-outline-variant/30 rounded-xl p-space-sm opacity-80 flex items-center justify-between gap-space-sm">
                <div class="flex items-center gap-space-md">
                  <div class="relative shrink-0"><div class="w-12 h-12 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center font-headline-sm border border-outline-variant">{{ initials(b.member.name) }}</div><span class="absolute bottom-0 right-0 w-3 h-3 bg-outline border-2 border-surface-container-lowest rounded-full"></span></div>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap"><h5 class="font-label-lg text-label-lg text-on-surface font-semibold">{{ b.member.name }}</h5><span class="px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant font-label-sm text-label-sm">Busy · {{ b.freeAt !== null ? 'Free at ' + fmt(b.freeAt) : 'Not free today' }}</span></div>
                    <span class="font-body-sm text-body-sm text-outline">{{ b.member.title || b.member.role }}</span>
                  </div>
                </div>
                <div class="w-5 h-5 rounded-full border-2 border-outline-variant/60 bg-surface-container-high/40 cursor-not-allowed shrink-0"></div>
              </div>
            }
          </div>
        </section>
      }
    </main>

    <aside class="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/50 shadow-lg no-print">
      <div class="max-w-screen-md mx-auto px-space-md py-space-sm flex items-center justify-between gap-space-md">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[20px]">person_check</span></div>
          <div class="truncate"><p class="font-label-lg text-label-lg text-on-surface font-bold truncate">{{ selectedName() }}</p><p class="font-body-sm text-body-sm text-primary flex items-center gap-1 font-semibold"><span class="material-symbols-outlined text-[14px]">alarm</span> {{ slotLabel() }}</p></div>
        </div>
        <button type="button" (click)="next()" class="shrink-0 bg-[#FF7A59] hover:bg-[#F06543] active:scale-95 text-white font-label-lg text-label-lg px-space-lg py-3 rounded-xl elevation-cta transition-all flex items-center gap-2 font-bold"><span>{{ 'stylist.proceed' | translate }}</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span></button>
      </div>
    </aside>
  `,
})
export class StylistPage implements OnInit {
  protected readonly flow = inject(BookingFlowStore);
  private readonly store = inject(SalonStore);
  private readonly avail = inject(AvailabilityService);
  private readonly router = inject(Router);
  protected readonly fmt = fmt12;
  protected readonly initials = initials;

  private readonly date = computed(() => this.flow.date() ?? '');
  private readonly start = computed(() => this.flow.start() ?? 0);

  protected readonly free = computed(() => {
    const opt = this.avail.slots(this.date(), { serviceIds: this.flow.serviceIds(), includeBusy: true }).find((s) => s.start === this.start());
    return this.store.staff().filter((s) => opt?.staffIds.includes(s.id));
  });
  protected readonly busy = computed(() =>
    this.avail.busyStaff(this.date(), this.flow.serviceIds(), this.start(), this.flow.totalDuration()).map((b) => ({ member: this.store.staffById(b.staffId)!, freeAt: b.freeAt })),
  );
  protected readonly slotLabel = computed(() => {
    if (!this.date()) return '';
    const d = new Date(this.date() + 'T00:00');
    return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${fmt12(this.start())}`;
  });
  protected readonly selectedName = computed(() => (this.flow.staffId() === 'any' ? 'Any available specialist' : `${this.store.staffById(this.flow.staffId())?.name ?? ''} selected`));

  ngOnInit() {
    if (!this.flow.serviceIds().length || !this.flow.date() || this.flow.start() === null) {
      this.router.navigate(['/s', this.store.profile().slug, this.flow.serviceIds().length ? 'slot' : 'services'], { replaceUrl: true });
      return;
    }
    // Keep a previously chosen stylist only if they are still free.
    if (this.flow.staffId() !== 'any' && !this.free().some((m) => m.id === this.flow.staffId())) this.flow.staffId.set('any');
  }

  rating(id: string) {
    const st = this.store.stats().find((s) => s.staffId === id);
    return st && st.rating > 0 ? st : null;
  }

  specialty(id: string) {
    const names = (this.store.staffById(id)?.serviceIds ?? []).map((sid) => this.store.serviceById(sid)?.name.split(' ').slice(0, 2).join(' ')).filter(Boolean);
    return names.slice(0, 2).join(' & ') || 'All-rounder';
  }

  /** Stylist's bookings and break around the chosen slot, plus the slot itself. */
  timeline(id: string) {
    const date = this.date();
    const start = this.start();
    const items: { key: string; kind: 'busy' | 'break' | 'mine'; start: number }[] = this.store
      .bookingsFor(date)
      .filter((b) => b.staffId === id)
      .map((b) => ({ key: b.id, kind: 'busy' as const, start: b.start }));
    const brk = this.store.brk();
    if (brk.enabled && brk.blockSlots) items.push({ key: 'brk', kind: 'break', start: toMin(brk.start) });
    items.push({ key: 'mine', kind: 'mine', start });
    return items.sort((a, b) => Math.abs(a.start - start) - Math.abs(b.start - start)).slice(0, 5).sort((a, b) => a.start - b.start);
  }

  next() {
    this.router.navigate(['/s', this.store.profile().slug, 'pay']);
  }
}
