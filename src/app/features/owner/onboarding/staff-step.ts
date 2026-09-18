import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StaffMember } from '../../../core/models';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { initials } from '../../../core/utils/time';
import { WizardHeader } from '../../../shared/layout/wizard-header';
import { DayPicker } from '../../../shared/ui/day-picker';

const ROLES = ['Stylist', 'Colorist', 'Esthetician', 'Manager'];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FIELD =
  'w-full pl-9 pr-3 py-2 text-body-md font-body-md rounded-lg border border-outline-variant/40 bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary text-on-surface placeholder:text-outline-variant transition-all';

@Component({
  selector: 'app-staff-step',
  imports: [FormsModule, WizardHeader, DayPicker],
  template: `
    <div class="min-h-screen flex flex-col bg-surface text-on-surface antialiased">
      <app-wizard-header [active]="4" />

      <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <div class="mb-8">
          <div class="flex items-center gap-2 text-primary font-label-sm text-label-sm uppercase tracking-wider mb-2">
            <span class="material-symbols-outlined text-[16px]">group_add</span>
            <span>Final Step • Setup Complete in ~3 Mins</span>
          </div>
          <h1 class="text-headline-lg-mobile md:text-headline-lg font-headline-lg text-on-surface tracking-tight">Add Your Stylists &amp; Specialists</h1>
          <p class="text-body-lg font-body-lg text-muted mt-1 max-w-2xl">Assign staff members, the services they perform, working shifts, and commission splits.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <section class="lg:col-span-7 flex flex-col gap-6">
            <div class="flex items-center gap-2">
              <h2 class="text-headline-sm font-headline-sm text-on-surface">Active Team Roster</h2>
              <span class="px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-primary/10 text-primary font-semibold">{{ store.staff().length }} Added</span>
            </div>

            <div class="grid grid-cols-1 gap-4">
              @for (m of store.staff(); track m.id) {
                <article class="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/30 shadow-level-1 hover:shadow-level-2 hover:border-primary/40 transition-all duration-200" [class.ring-2]="editingId() === m.id" [class.ring-primary]="editingId() === m.id">
                  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
                    <div class="flex items-center gap-4 min-w-0">
                      <div class="relative shrink-0">
                        @if (m.photo) {
                          <img class="w-14 h-14 rounded-full object-cover ring-2 ring-primary/20" [src]="m.photo" [alt]="m.name" />
                        } @else {
                          <div class="w-14 h-14 rounded-full ring-2 ring-primary/20 bg-primary-container text-on-primary-container flex items-center justify-center font-headline-sm text-headline-sm">{{ initials(m.name) }}</div>
                        }
                        <span class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#22A06B] border-2 border-surface-container-lowest rounded-full"></span>
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <h3 class="text-headline-sm font-headline-sm text-on-surface">{{ m.name }}</h3>
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-[#22A06B]/15 text-[#166534]">Active</span>
                        </div>
                        <p class="text-label-md font-label-md text-primary font-medium">{{ m.title || m.role }}</p>
                        <p class="text-body-sm font-body-sm text-muted flex items-center gap-1 mt-0.5"><span class="material-symbols-outlined text-[14px]">call</span> {{ m.phone }}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 self-end sm:self-center">
                      <button type="button" class="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-container-low transition-colors duration-150" title="Edit Staff Details" (click)="edit(m)"><span class="material-symbols-outlined text-[20px]">edit</span></button>
                      <button type="button" class="p-2 rounded-lg text-muted hover:text-error hover:bg-error-container/30 transition-colors duration-150" title="Remove Staff" (click)="remove(m)"><span class="material-symbols-outlined text-[20px]">delete</span></button>
                    </div>
                  </div>
                  <div class="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="sm:col-span-2">
                      <span class="text-label-sm font-label-sm text-muted block mb-1.5 uppercase">Services Assigned</span>
                      <div class="flex flex-wrap gap-1.5">
                        @for (n of serviceNames(m); track n) {
                          <span class="px-2.5 py-1 rounded-md text-label-sm font-label-sm bg-surface-container text-on-surface">{{ n }}</span>
                        } @empty {
                          <span class="text-body-sm text-muted">None yet</span>
                        }
                      </div>
                    </div>
                    <div>
                      <span class="text-label-sm font-label-sm text-muted block mb-1.5 uppercase">Commission Split</span>
                      <div class="flex items-center gap-1.5 text-headline-sm font-headline-sm text-primary">
                        <span class="material-symbols-outlined text-[18px]">percent</span><span>{{ m.commission }}% on services</span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-4 pt-3 border-t border-outline-variant/10 flex items-center justify-between">
                    <span class="text-label-sm font-label-sm text-muted">Working Shifts</span>
                    <div class="flex gap-1">
                      @for (d of m.days; track $index) {
                        <span class="w-6 h-6 rounded flex items-center justify-center text-label-sm font-label-sm" [class]="d ? 'bg-primary text-on-primary' : 'bg-surface-container text-muted opacity-40'">{{ dayLetters[$index] }}</span>
                      }
                    </div>
                  </div>
                </article>
              } @empty {
                <div class="rounded-xl border-2 border-dashed border-outline-variant/50 p-10 text-center text-muted">
                  <span class="material-symbols-outlined text-4xl text-primary/40">group_add</span>
                  <p class="mt-2 font-label-lg text-label-lg text-on-surface">No team members yet</p>
                  <p class="text-body-sm">Add your first stylist using the form.</p>
                </div>
              }
            </div>

            <div class="rounded-lg p-4 bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
              <span class="material-symbols-outlined text-primary text-[20px] mt-0.5">info</span>
              <div>
                <h4 class="text-label-lg font-label-lg text-on-surface">Auto-Sync Shifts with Appointment Calendar</h4>
                <p class="text-body-sm font-body-sm text-muted mt-0.5">Staff will only appear bookable on customer portals during their assigned working days and active slots.</p>
              </div>
            </div>
          </section>

          <aside class="lg:col-span-5 bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-level-2">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4 mb-6">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><span class="material-symbols-outlined text-[20px]">{{ editingId() ? 'edit' : 'person_add' }}</span></div>
                <div>
                  <h2 class="text-headline-sm font-headline-sm text-on-surface">{{ editingId() ? 'Edit Staff Member' : 'Add New Staff Member' }}</h2>
                  <p class="text-body-sm font-body-sm text-muted">Direct invite or manual profile</p>
                </div>
              </div>
              <span class="text-label-sm font-label-sm text-muted bg-surface-container px-2 py-0.5 rounded">{{ editingId() ? 'Editing' : 'Chair #' + (store.staff().length + 1) }}</span>
            </div>

            <form class="space-y-5" (submit)="$event.preventDefault(); submit()" novalidate>
              <div class="flex items-center gap-4">
                <label class="relative w-16 h-16 rounded-full border-2 border-dashed border-outline-variant flex flex-col items-center justify-center bg-surface-container-low text-muted hover:border-primary cursor-pointer transition-colors group overflow-hidden shrink-0">
                  <input type="file" class="sr-only" accept="image/png,image/jpeg" (change)="onPhoto($any($event.target).files?.[0])" />
                  @if (photo()) {
                    <img [src]="photo()" alt="Staff photo preview" class="absolute inset-0 w-full h-full object-cover" />
                  } @else {
                    <span class="material-symbols-outlined text-[22px] group-hover:text-primary transition-colors">add_a_photo</span>
                    <span class="text-[9px] font-medium mt-0.5 text-outline">Upload</span>
                  }
                </label>
                <div>
                  <p class="text-label-md font-label-md text-on-surface">Staff Profile Photo</p>
                  <p class="text-body-sm font-body-sm text-muted">PNG, JPG up to 5MB. Clear face photo recommended.</p>
                </div>
              </div>

              <div>
                <label class="block text-label-md font-label-md text-on-surface mb-1.5" for="st-name">Full Name</label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline"><span class="material-symbols-outlined text-[18px]">person</span></span>
                  <input id="st-name" type="text" name="name" [class]="field" placeholder="e.g., Amit Patel" [ngModel]="name()" (ngModelChange)="name.set($event)" />
                </div>
                @if (submitted() && !name().trim()) { <p class="text-body-sm text-error mt-1">Name is required.</p> }
              </div>

              <div>
                <label class="block text-label-md font-label-md text-on-surface mb-1.5" for="st-phone">Phone Number</label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline"><span class="material-symbols-outlined text-[18px]">call</span></span>
                  <input id="st-phone" type="tel" name="phone" [class]="field" placeholder="+91 98111 22233" [ngModel]="phone()" (ngModelChange)="phone.set($event)" />
                </div>
                @if (submitted() && !phoneOk()) { <p class="text-body-sm text-error mt-1">Enter a valid 10-digit mobile number.</p> }
              </div>

              <div>
                <span class="block text-label-md font-label-md text-on-surface mb-1.5">Role / Designation</span>
                <div class="grid grid-cols-2 gap-2" role="radiogroup">
                  @for (r of roles; track r) {
                    <label class="flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-label-sm font-label-sm transition-colors" [class]="role() === r ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/40 hover:border-primary text-on-surface'">
                      <input type="radio" name="role" class="text-primary focus:ring-primary h-4 w-4" [checked]="role() === r" (change)="role.set(r)" />
                      <span>{{ r }}</span>
                    </label>
                  }
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-label-md font-label-md text-on-surface">Services Assigned</span>
                  <button type="button" class="text-label-sm font-label-sm text-primary hover:underline" (click)="toggleAllServices()">{{ allSelected() ? 'Clear All' : 'Select All' }}</button>
                </div>
                <div class="flex flex-wrap gap-2 pt-1">
                  @for (s of store.selectedServices(); track s.id) {
                    <button type="button" (click)="toggleService(s.id)" [attr.aria-pressed]="serviceIds().includes(s.id)" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-label-sm border cursor-pointer transition-colors" [class]="serviceIds().includes(s.id) ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/50 text-muted hover:border-primary'">
                      @if (serviceIds().includes(s.id)) { <span class="material-symbols-outlined text-[14px]">check</span> }
                      <span>{{ s.name }}</span>
                    </button>
                  }
                </div>
                @if (submitted() && !serviceIds().length) { <p class="text-body-sm text-error mt-1">Assign at least one service.</p> }
              </div>

              <div>
                <span class="block text-label-md font-label-md text-on-surface mb-1.5">Working Days</span>
                <app-day-picker [days]="days()" (daysChange)="days.set($event)" />
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-label-md font-label-md text-on-surface" for="st-commission">Commission on Services</label>
                  <div class="flex items-center gap-1 bg-surface-container px-2.5 py-1 rounded-md">
                    <input type="number" min="0" max="100" name="commission-num" aria-label="Commission percent" class="w-10 p-0 text-right bg-transparent border-0 font-bold text-primary focus:ring-0 text-label-md" [ngModel]="commission()" (ngModelChange)="setCommission($event)" />
                    <span class="text-label-sm font-label-sm text-primary">%</span>
                  </div>
                </div>
                <input id="st-commission" type="range" min="0" max="70" class="w-full accent-primary h-2 bg-surface-container-high rounded-lg cursor-pointer" [value]="commission()" (input)="setCommission($any($event.target).value)" />
                <div class="flex justify-between text-[11px] text-muted mt-1"><span>0% (Salary Only)</span><span>20% (Standard)</span><span>50%+ (Senior)</span></div>
              </div>

              <div class="pt-2 flex gap-2">
                @if (editingId()) {
                  <button type="button" (click)="reset()" class="py-2.5 px-4 rounded-lg border border-outline-variant/50 text-on-surface hover:bg-surface-container-low font-semibold text-label-lg transition-all">Cancel</button>
                }
                <button type="submit" class="flex-1 py-2.5 px-4 rounded-lg border-2 border-primary text-primary hover:bg-primary/5 font-semibold text-label-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99]">
                  <span class="material-symbols-outlined text-[20px]">{{ editingId() ? 'save' : 'add' }}</span>
                  <span>{{ editingId() ? 'Save Changes' : 'Add Staff Member' }}</span>
                </button>
              </div>
            </form>
          </aside>
        </div>
      </main>

      <footer class="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/20 py-4 px-4 md:px-12 shadow-[0_-8px_25px_rgba(31,42,46,0.06)]">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <button type="button" (click)="back()" class="inline-flex items-center gap-2 text-label-lg font-label-lg text-muted hover:text-on-surface px-4 py-2 rounded-lg hover:bg-surface-container-low transition-colors duration-150">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span><span>Back to Timings</span>
          </button>
          <div class="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <div class="hidden lg:flex flex-col text-right">
              <span class="text-label-sm font-label-sm font-semibold" [class]="store.staff().length ? 'text-primary' : 'text-secondary'">{{ store.staff().length ? '100% Steps Configured' : 'Add at least one team member' }}</span>
              <span class="text-body-sm font-body-sm text-muted">Ready to take online appointments</span>
            </div>
            <button type="button" (click)="finish()" class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-secondary-container hover:bg-[#ff6842] text-on-secondary-container font-headline-sm text-headline-sm tracking-wide shadow-[0_8px_20px_-2px_rgba(253,121,88,0.45)] hover:shadow-[0_12px_28px_-2px_rgba(253,121,88,0.55)] transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2.5">
              <span>Complete Setup &amp; Launch Salon 🚀</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class StaffStep {
  protected readonly store = inject(SalonStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly roles = ROLES;
  protected readonly dayLetters = DAY_LETTERS;
  protected readonly field = FIELD;
  protected readonly initials = initials;

  protected readonly editingId = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly role = signal('Stylist');
  protected readonly serviceIds = signal<string[]>([]);
  protected readonly days = signal<boolean[]>([true, true, true, true, true, false, false]);
  protected readonly commission = signal(20);
  protected readonly photo = signal<string | null>(null);

  protected readonly phoneOk = computed(() => this.phone().replace(/\D/g, '').length >= 10);
  protected readonly allSelected = computed(() => {
    const all = this.store.selectedServices();
    return all.length > 0 && all.every((s) => this.serviceIds().includes(s.id));
  });

  serviceNames(m: StaffMember) {
    return m.serviceIds.map((id) => this.store.serviceById(id)).filter((s) => s?.selected).map((s) => s!.name.split(' ').slice(0, 2).join(' '));
  }

  toggleService(id: string) {
    this.serviceIds.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  toggleAllServices() {
    this.serviceIds.set(this.allSelected() ? [] : this.store.selectedServices().map((s) => s.id));
  }

  setCommission(v: number | string) {
    this.commission.set(Math.min(100, Math.max(0, Math.round(Number(v) || 0))));
  }

  onPhoto(file: File | undefined | null) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return this.toast.error('Photo must be a PNG or JPG image.');
    if (file.size > 5 * 1024 * 1024) return this.toast.error('Photo must be 5MB or smaller.');
    const reader = new FileReader();
    reader.onload = () => this.photo.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  edit(m: StaffMember) {
    this.editingId.set(m.id);
    this.name.set(m.name);
    this.phone.set(m.phone);
    this.role.set(ROLES.includes(m.role) ? m.role : 'Stylist');
    this.serviceIds.set([...m.serviceIds]);
    this.days.set([...m.days]);
    this.commission.set(m.commission);
    this.photo.set(m.photo);
    this.submitted.set(false);
  }

  reset() {
    this.editingId.set(null);
    this.name.set('');
    this.phone.set('');
    this.role.set('Stylist');
    this.serviceIds.set([]);
    this.days.set([true, true, true, true, true, false, false]);
    this.commission.set(20);
    this.photo.set(null);
    this.submitted.set(false);
  }

  remove(m: StaffMember) {
    this.store.removeStaff(m.id);
    if (this.editingId() === m.id) this.reset();
    this.toast.info(`${m.name} removed`);
  }

  submit() {
    this.submitted.set(true);
    if (!this.name().trim() || !this.phoneOk() || !this.serviceIds().length) return;
    const existing = this.store.staffById(this.editingId());
    const m: StaffMember = {
      id: existing?.id ?? 'st' + Date.now().toString(36),
      name: this.name().trim(),
      role: this.role(),
      title: existing && existing.role === this.role() ? existing.title : this.role(),
      phone: this.phone().trim(),
      email: existing?.email ?? '',
      serviceIds: this.serviceIds(),
      days: this.days(),
      commission: this.commission(),
      photo: this.photo(),
      status: existing?.status ?? 'on-duty',
    };
    this.store.upsertStaff(m);
    this.toast.success(existing ? `${m.name} updated` : `${m.name} added to your team`);
    this.reset();
  }

  back() {
    this.router.navigateByUrl('/owner/onboarding/timings');
  }

  finish() {
    if (!this.store.staff().length) return this.toast.error('Add at least one team member to launch your salon.');
    this.store.completeSetup();
    this.router.navigateByUrl('/owner/onboarding/done');
  }
}
