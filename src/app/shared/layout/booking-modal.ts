import { TranslatePipe } from '@ngx-translate/core';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { dateKey, toHHmm, toMin } from '../../core/utils/time';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL } from '../ui/form-classes';
import { Modal } from '../ui/modal';

@Component({
  selector: 'app-booking-modal',
  imports: [FormsModule, Modal, TranslatePipe],
  template: `
    <app-modal [open]="ui.bookingModal() !== null" [title]="'New Appointment' | translate" (closed)="ui.closeBooking()">
      <form class="space-y-4" (ngSubmit)="submit()" #f="ngForm">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label [class]="label" for="bk-client">{{ "Client name" | translate }}</label>
            <input id="bk-client" name="client" [class]="input" [(ngModel)]="client" required [placeholder]="'e.g., Ananya Roy' | translate" />
          </div>
          <div>
            <label [class]="label" for="bk-phone">{{ "Mobile number" | translate }}</label>
            <input id="bk-phone" name="phone" [class]="input" [(ngModel)]="phone" placeholder="98765 43210" inputmode="tel" autocomplete="off" />
          </div>
        </div>
        <div>
          <label [class]="label" for="bk-service">{{ "Service" | translate }}</label>
          <select id="bk-service" name="service" [class]="input" [ngModel]="serviceId()" (ngModelChange)="pickService($event)" required>
            @for (s of store.selectedServices(); track s.id) {
              <option [value]="s.id">{{ s.name }} · ₹{{ s.price }} · {{ s.duration }}m</option>
            }
          </select>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label [class]="label" for="bk-staff">{{ "Stylist" | translate }}</label>
            <select id="bk-staff" name="staff" [class]="input" [(ngModel)]="staffId" required>
              @for (s of store.staff(); track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </select>
          </div>
          <div>
            <label [class]="label" for="bk-date">{{ "Date" | translate }}</label>
            <input id="bk-date" name="date" type="date" [class]="input" [(ngModel)]="date" required />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label [class]="label" for="bk-time">{{ "Start time" | translate }}</label>
            <input id="bk-time" name="time" type="time" step="900" [class]="input" [(ngModel)]="time" required />
          </div>
          <div>
            <label [class]="label" for="bk-duration">{{ "Duration (mins)" | translate }}</label>
            <input id="bk-duration" name="duration" type="number" min="5" step="5" [class]="input" [(ngModel)]="duration" required />
          </div>
        </div>
        <div class="flex items-center justify-between pt-4 border-t border-outline-variant/20">
          <span class="font-headline-sm text-headline-sm text-on-surface">₹{{ price() }}</span>
          <div class="flex items-center gap-3">
            <button type="button" [class]="ghost" (click)="ui.closeBooking()">{{ "Cancel" | translate }}</button>
            <button type="submit" [class]="primary" [disabled]="f.invalid || saving()">{{ "Book appointment" | translate }}</button>
          </div>
        </div>
      </form>
    </app-modal>
  `,
})
export class BookingModal {
  protected readonly ui = inject(UiService);
  protected readonly store = inject(SalonStore);
  private readonly toast = inject(ToastService);
  protected readonly input = INPUT;
  protected readonly label = LABEL;
  protected readonly primary = BTN_PRIMARY;
  protected readonly ghost = BTN_GHOST;

  client = '';
  phone = '';
  staffId = '';
  date = dateKey(new Date());
  time = '10:00';
  duration = 45;
  readonly serviceId = signal('');
  readonly price = signal(0);
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      const p = this.ui.bookingModal();
      if (!p) return;
      untracked(() => {
        const first = this.store.selectedServices()[0];
        this.client = '';
        this.phone = '';
        this.date = p.date ?? dateKey(new Date());
        this.staffId = p.staffId ?? this.store.staff()[0]?.id ?? '';
        this.time = toHHmm(p.start ?? Math.ceil(this.store.nowMin() / 15) * 15);
        if (first) this.pickService(first.id);
      });
    });
  }

  pickService(id: string) {
    this.serviceId.set(id);
    const s = this.store.serviceById(id);
    if (s) {
      this.duration = s.duration;
      this.price.set(s.price);
    }
  }

  async submit() {
    const s = this.store.serviceById(this.serviceId());
    if (!s || this.saving()) return;
    const digits = this.phone.replace(/\D/g, '').slice(-10);
    if (this.phone.trim() && digits.length !== 10) return this.toast.error('Enter a valid 10-digit mobile number.');
    this.saving.set(true);
    const res = await this.store.addOwnerBooking({
      date: this.date, staffId: this.staffId, serviceIds: [s.id], start: toMin(this.time), client: this.client.trim(), phone: digits,
      duration: Number(this.duration) !== s.duration ? Number(this.duration) : undefined,
    });
    this.saving.set(false);
    if (!res.ok) {
      this.toast.error(res.error ?? 'Could not create booking');
      return;
    }
    this.toast.success('Booked {{p1}} with {{p2}}', { p1: this.client, p2: this.store.staffById(this.staffId)?.name });
    this.ui.closeBooking();
  }
}
