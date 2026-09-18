import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WEEKDAYS } from '../../../core/models';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { dateKey, fmt12, fmt12Str, toMin } from '../../../core/utils/time';
import { WizardHeader } from '../../../shared/layout/wizard-header';
import { Toggle } from '../../../shared/ui/toggle';

interface PreviewSlot {
  kind: 'slot' | 'break';
  start: number;
  end: number;
  booked: boolean;
}

const TIME_BOX =
  'flex items-center bg-white px-2.5 py-1.5 border border-outline-variant/40 rounded-lg text-xs font-medium text-on-surface focus-within:ring-2 focus-within:ring-primary';
const TIME_INPUT = 'no-picker border-0 p-0 bg-transparent text-xs font-medium focus:ring-0 focus:outline-none w-[5.5rem]';

@Component({
  selector: 'app-timings-step',
  imports: [FormsModule, WizardHeader, Toggle],
  template: `
    <div class="min-h-screen flex flex-col bg-background text-on-surface antialiased selection:bg-primary selection:text-on-primary pb-24">
      <app-wizard-header [active]="3" />

      <main class="max-w-7xl w-full mx-auto px-4 md:px-6 py-8 flex-1">
        <div class="mb-8">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm uppercase tracking-wide">Step 3 of 4</span>
            <span class="text-muted text-xs">• Approx. 3 mins remaining</span>
          </div>
          <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Working Hours &amp; Booking Slot Rules</h1>
          <p class="font-body-lg text-body-lg text-muted mt-1">Configure weekly schedule, staff lunch breaks, and appointment slot generation.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <section class="lg:col-span-6 space-y-6">
            <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-level-1">
              <div class="flex items-center justify-between gap-3 pb-4 border-b border-outline-variant/20 mb-4">
                <div>
                  <h2 class="font-headline-md text-headline-md text-on-surface">Operating Hours (Weekly)</h2>
                  <p class="font-body-sm text-body-sm text-muted">Set when your salon chairs are accessible for client appointments.</p>
                </div>
                <button type="button" (click)="applyMonday()" class="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0">
                  <span class="material-symbols-outlined text-sm">content_copy</span> Apply Mon to All
                </button>
              </div>
              <div class="space-y-3.5">
                @for (t of store.timings(); track $index) {
                  <div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-surface-bright border border-outline-variant/20 hover:border-primary/40 transition-colors">
                    <div class="flex items-center gap-3 w-36">
                      <app-toggle [checked]="t.open" (checkedChange)="store.patchTiming($index, { open: $event })" [label]="days[$index] + ' open'" />
                      <span class="font-label-lg text-label-lg text-on-surface font-semibold">{{ days[$index] }}</span>
                    </div>
                    @if (t.open) {
                      <div class="flex items-center gap-2">
                        <div [class]="timeBox">
                          <span class="material-symbols-outlined text-muted text-sm mr-1.5">schedule</span>
                          <input type="time" [class]="timeInput" [ngModel]="t.start" (ngModelChange)="store.patchTiming($index, { start: $event })" [attr.aria-label]="days[$index] + ' opens'" />
                        </div>
                        <span class="text-muted text-xs font-semibold">to</span>
                        <div [class]="timeBox">
                          <span class="material-symbols-outlined text-muted text-sm mr-1.5">schedule</span>
                          <input type="time" [class]="timeInput" [ngModel]="t.end" (ngModelChange)="store.patchTiming($index, { end: $event })" [attr.aria-label]="days[$index] + ' closes'" />
                        </div>
                      </div>
                    } @else {
                      <span class="text-xs font-semibold text-muted bg-surface-container px-3 py-1.5 rounded-lg">Closed</span>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-level-1">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-secondary-fixed/50 flex items-center justify-center text-secondary">
                    <span class="material-symbols-outlined">restaurant</span>
                  </div>
                  <div>
                    <h3 class="font-headline-sm text-headline-sm text-on-surface">Daily Lunch / Sanitization Break</h3>
                    <p class="font-body-sm text-body-sm text-muted">All stylist chairs pause simultaneously</p>
                  </div>
                </div>
                <app-toggle [checked]="store.brk().enabled" (checkedChange)="store.brk.update(b => ({ ...b, enabled: $event }))" label="Daily break" />
              </div>
              @if (store.brk().enabled) {
                <div class="mt-4 pt-4 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-4">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-semibold text-muted">Break Interval:</span>
                    <div class="flex items-center bg-surface-bright px-3 py-1.5 border border-outline-variant/40 rounded-lg text-xs font-medium gap-1">
                      <span class="material-symbols-outlined text-muted text-sm mr-1">timelapse</span>
                      <input type="time" [class]="timeInput" [ngModel]="store.brk().start" (ngModelChange)="store.brk.update(b => ({ ...b, start: $event }))" aria-label="Break starts" />
                      <span>-</span>
                      <input type="time" [class]="timeInput" [ngModel]="store.brk().end" (ngModelChange)="store.brk.update(b => ({ ...b, end: $event }))" aria-label="Break ends" />
                    </div>
                    <span class="text-xs" [class]="breakMins() > 0 ? 'text-muted' : 'text-error'">({{ breakMins() > 0 ? breakMins() + ' mins' : 'end must be after start' }})</span>
                  </div>
                  <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" class="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant/60" [checked]="store.brk().blockSlots" (change)="store.brk.update(b => ({ ...b, blockSlots: $any($event.target).checked }))" />
                    <span class="font-body-sm text-body-sm font-medium text-on-surface">Block all booking slots during this break</span>
                  </label>
                </div>
              }
            </div>
          </section>

          <section class="lg:col-span-6 space-y-6">
            <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-level-1">
              <div class="pb-4 border-b border-outline-variant/20 mb-5">
                <h2 class="font-headline-md text-headline-md text-on-surface">Slot Generation Engine</h2>
                <p class="font-body-sm text-body-sm text-muted">Choose how the salon schedule is partitioned into bookable time windows.</p>
              </div>

              <div class="space-y-4" role="radiogroup">
                <label class="block relative p-4 rounded-xl border-2 cursor-pointer shadow-level-1 transition-all" [class]="store.slotMode() === 'auto' ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-outline bg-surface-bright/40 shadow-none'">
                  <div class="flex items-start gap-3">
                    <input type="radio" name="slot_mode" class="mt-1 w-4 h-4 text-primary focus:ring-primary border-outline-variant" [checked]="store.slotMode() === 'auto'" (change)="store.slotMode.set('auto')" />
                    <div class="flex-1">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-headline-sm text-headline-sm text-on-surface">Auto slots by service duration</span>
                          <span class="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-label-sm uppercase tracking-wider">Recommended</span>
                        </div>
                        <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
                      </div>
                      <p class="font-body-sm text-body-sm text-muted mt-1">Smart Engine: dynamically builds slots based on selected service length and client turnover buffer.</p>
                      <div class="mt-3 flex flex-wrap items-center gap-4 pt-3 border-t border-primary/20 text-xs text-on-surface">
                        <div class="flex items-center gap-1.5">
                          <span class="material-symbols-outlined text-sm text-primary">hourglass_empty</span>
                          <span class="font-medium">Buffer Between Clients:</span>
                        </div>
                        <select class="text-xs py-1 px-2.5 bg-white border border-outline-variant/40 rounded-md focus:ring-1 focus:ring-primary text-on-surface font-semibold" aria-label="Buffer between clients" [ngModel]="store.buffer()" (ngModelChange)="store.buffer.set(+$event)">
                          @for (b of buffers; track b) {
                            <option [ngValue]="b">{{ b === 0 ? 'No buffer' : b + ' min buffer' }}</option>
                          }
                        </select>
                      </div>
                    </div>
                  </div>
                </label>

                <label class="block relative p-4 rounded-xl border-2 cursor-pointer transition-all" [class]="store.slotMode() === 'custom' ? 'border-primary bg-primary/5 shadow-level-1' : 'border-outline-variant/30 hover:border-outline bg-surface-bright/40'">
                  <div class="flex items-start gap-3">
                    <input type="radio" name="slot_mode" class="mt-1 w-4 h-4 text-primary focus:ring-primary border-outline-variant" [checked]="store.slotMode() === 'custom'" (change)="store.slotMode.set('custom')" />
                    <div class="flex-1">
                      <div class="flex items-center justify-between">
                        <span class="font-headline-sm text-headline-sm text-on-surface">Custom slots (fixed intervals)</span>
                        <span class="material-symbols-outlined text-muted">tune</span>
                      </div>
                      <p class="font-body-sm text-body-sm text-muted mt-1">Set fixed slot intervals e.g., 30 min / 45 min / 60 min, starting from opening time.</p>
                      <div class="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-outline-variant/20 text-xs">
                        <span class="text-muted font-medium">Standard Interval:</span>
                        @for (i of store.customIntervals(); track i) {
                          <button type="button" (click)="pickInterval(i)" class="px-2.5 py-1 rounded border text-xs font-medium transition-colors" [class]="store.slotMode() === 'custom' && store.customInterval() === i ? 'bg-primary text-on-primary border-primary' : 'bg-white border-outline-variant/40 hover:border-primary text-on-surface'">{{ i }} min</button>
                        }
                        @if (addingInterval()) {
                          <input type="number" min="5" step="5" class="w-16 py-1 px-2 text-xs rounded border border-outline-variant/40 focus:ring-1 focus:ring-primary" aria-label="Custom interval in minutes" placeholder="mins" [(ngModel)]="newInterval" (keydown.enter)="$event.preventDefault(); addInterval()" />
                          <button type="button" class="text-primary font-semibold" (click)="addInterval()">Add</button>
                        } @else {
                          <button type="button" class="px-2 py-1 text-primary hover:underline font-semibold ml-auto flex items-center gap-0.5" (click)="addingInterval.set(true)">
                            <span class="material-symbols-outlined text-sm">add</span> Add Custom
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              <div class="mt-8 pt-6 border-t border-outline-variant/20">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-lg">visibility</span>
                    <h3 class="font-headline-sm text-headline-sm text-on-surface">Visual Slot Preview</h3>
                    <span class="text-xs text-muted">(Sample generation for Today)</span>
                  </div>
                  <div class="flex items-center gap-3 text-[11px] font-label-sm">
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full border border-primary bg-white inline-block"></span><span class="text-muted">Available</span></span>
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span><span class="text-muted">Selected</span></span>
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-surface-variant inline-block"></span><span class="text-muted">Busy</span></span>
                  </div>
                </div>
                <div class="bg-surface-bright border border-outline-variant/30 rounded-lg p-3 text-xs text-muted mb-4 flex items-center justify-between gap-3">
                  @if (previewService(); as ps) {
                    <span>Showing generated slots for <strong class="text-on-surface">{{ ps.name }} ({{ ps.duration }} min)</strong>{{ store.slotMode() === 'auto' ? ' with ' + store.buffer() + ' min turnover buffer.' : ' every ' + store.customInterval() + ' min.' }}</span>
                    <button type="button" class="text-primary font-semibold hover:underline shrink-0" (click)="cycleService()">Change Service</button>
                  } @else {
                    <span>Select at least one service in step 2 to preview slots.</span>
                  }
                </div>

                @if (todayClosed()) {
                  <p class="text-center text-sm text-muted py-6">The salon is closed today. Slots are generated for open days.</p>
                } @else {
                  <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    @for (s of slots(); track s.start + '-' + s.kind) {
                      @if (s.kind === 'break') {
                        <div class="col-span-2 cursor-not-allowed bg-surface-container border border-dashed border-outline-variant text-muted py-2 px-3 rounded-lg text-center font-label-md text-label-md flex items-center justify-center gap-2 opacity-80">
                          <span class="material-symbols-outlined text-sm">restaurant</span>
                          <span>{{ fmt(s.start) }} - {{ fmt(s.end) }} (Break)</span>
                        </div>
                      } @else if (s.booked) {
                        <div class="cursor-not-allowed bg-surface-container-low border border-outline-variant/20 text-muted py-2 px-3 rounded-lg text-center font-label-md text-label-md flex flex-col items-center justify-center line-through opacity-70">
                          <span>{{ fmt(s.start) }}</span>
                          <span class="text-[10px] text-muted no-underline">Booked</span>
                        </div>
                      } @else if (selectedStart() === s.start) {
                        <button type="button" (click)="selectedStart.set(null)" class="bg-primary text-on-primary py-2 px-3 rounded-lg text-center font-label-md text-label-md flex flex-col items-center justify-center shadow-level-2 transform -translate-y-0.5 transition-all">
                          <span class="font-bold">{{ fmt(s.start) }}</span>
                          <span class="text-[10px] text-on-primary/90 font-normal">Selected</span>
                        </button>
                      } @else {
                        <button type="button" (click)="selectedStart.set(s.start)" class="border-[1.5px] border-primary text-primary bg-surface-container-lowest hover:bg-primary/10 transition-colors py-2 px-3 rounded-lg text-center font-label-md text-label-md flex flex-col items-center justify-center">
                          <span>{{ fmt(s.start) }}</span>
                          <span class="text-[10px] text-primary/80 font-normal">Available</span>
                        </button>
                      }
                    }
                  </div>
                  <p class="text-xs text-muted mt-3 text-right">Total {{ slotCount() }} appointment slots generated for a {{ workHours() }}-hour workday.</p>
                }
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer class="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest border-t border-outline-variant/20 shadow-level-3">
        <div class="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-3">
          <button type="button" (click)="back()" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-outline-variant/60 text-on-surface hover:bg-surface-container-low font-label-lg text-label-lg transition-colors">
            <span class="material-symbols-outlined text-lg">arrow_back</span>
            <span class="hidden sm:inline">Back to Services</span><span class="sm:hidden">Back</span>
          </button>
          <div class="flex items-center gap-6">
            <div class="hidden md:flex flex-col text-right">
              <span class="font-label-sm text-label-sm text-muted">Next Step:</span>
              <span class="font-headline-sm text-headline-sm text-on-surface">Step 4: Staff &amp; Team</span>
            </div>
            <button type="button" (click)="next()" class="inline-flex items-center gap-2 px-6 md:px-7 py-3 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg shadow-level-2 transition-all hover:scale-[1.01] active:scale-[0.99]">
              <span class="hidden sm:inline">Continue to Staff &amp; Team</span><span class="sm:hidden">Continue</span>
              <span class="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class TimingsStep {
  protected readonly store = inject(SalonStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly days = WEEKDAYS;
  protected readonly buffers = [0, 5, 10, 15];
  protected readonly timeBox = TIME_BOX;
  protected readonly timeInput = TIME_INPUT;
  protected readonly fmt = fmt12;
  protected readonly fmtStr = fmt12Str;

  protected readonly addingInterval = signal(false);
  protected newInterval: number | null = null;
  protected readonly previewIdx = signal(0);
  protected readonly selectedStart = signal<number | null>(null);

  protected readonly breakMins = computed(() => toMin(this.store.brk().end) - toMin(this.store.brk().start));
  protected readonly previewService = computed(() => {
    const l = this.store.selectedServices();
    return l.length ? l[this.previewIdx() % l.length] : null;
  });
  protected readonly todayTiming = computed(() => this.store.dayTiming(dateKey(new Date())));
  protected readonly todayClosed = computed(() => !this.todayTiming().open);

  protected readonly slots = computed<PreviewSlot[]>(() => {
    const svc = this.previewService();
    const t = this.todayTiming();
    if (!svc || !t.open) return [];
    const open = toMin(t.start);
    const close = toMin(t.end);
    const brk = this.store.brk();
    const bs = toMin(brk.start);
    const be = toMin(brk.end);
    const useBreak = brk.enabled && brk.blockSlots && be > bs;
    const step = this.store.slotMode() === 'auto' ? svc.duration + this.store.buffer() : this.store.customInterval();
    const out: PreviewSlot[] = [];
    let cur = open;
    let n = 0;
    let breakAdded = false;
    while (cur + svc.duration <= close && n < 60) {
      if (useBreak && cur < be && cur + svc.duration > bs) {
        if (!breakAdded) {
          out.push({ kind: 'break', start: bs, end: be, booked: false });
          breakAdded = true;
        }
        cur = Math.max(cur + 1, be);
        continue;
      }
      out.push({ kind: 'slot', start: cur, end: cur + svc.duration, booked: n % 4 === 3 });
      cur += Math.max(5, step);
      n++;
    }
    return out;
  });
  protected readonly slotCount = computed(() => this.slots().filter((s) => s.kind === 'slot').length);
  protected readonly workHours = computed(() => {
    const t = this.todayTiming();
    return Math.round(((toMin(t.end) - toMin(t.start)) / 60) * 10) / 10;
  });

  applyMonday() {
    this.store.applyMondayToAll();
    this.toast.success("Monday's hours applied to all days");
  }

  pickInterval(i: number) {
    this.store.slotMode.set('custom');
    this.store.customInterval.set(i);
  }

  addInterval() {
    const v = Number(this.newInterval);
    if (!v || v < 5 || v > 240) return this.toast.error('Enter an interval between 5 and 240 minutes.');
    if (!this.store.customIntervals().includes(v)) {
      this.store.customIntervals.update((l) => [...l, v].sort((a, b) => a - b));
    }
    this.pickInterval(v);
    this.newInterval = null;
    this.addingInterval.set(false);
  }

  cycleService() {
    this.previewIdx.update((i) => i + 1);
    this.selectedStart.set(null);
  }

  back() {
    this.router.navigateByUrl('/owner/onboarding/services');
  }

  next() {
    if (!this.store.timings().some((t) => t.open)) return this.toast.error('Open at least one day of the week.');
    const bad = this.store.timings().find((t) => t.open && toMin(t.end) <= toMin(t.start));
    if (bad) return this.toast.error('Closing time must be after opening time.');
    if (this.store.brk().enabled && this.breakMins() <= 0) return this.toast.error('Break end must be after break start.');
    this.router.navigateByUrl('/owner/onboarding/staff');
  }
}
