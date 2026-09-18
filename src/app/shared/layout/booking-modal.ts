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
  imports: [FormsModule, Modal],
  template: `
    <app-modal [open]="ui.bookingModal() !== null" title="New Appointment" (closed)="ui.closeBooking()">
      <form class="space-y-4" (ngSubmit)="submit()" #f="ngForm">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label [class]="label" for="bk-client">Client name</label>
            <input id="bk-client" name="client" [class]="input" [(ngModel)]="client" required placeholder="e.g., Ananya Roy" />
          </div>
          <div>
            <label [class]="label" for="bk-phone">Mobile number</label>
            <input id="bk-phone" name="phone" [class]="input" [(ngModel)]="phone" placeholder="+91 98765 43210" />
          </div>
        </div>
        <div>
          <label [class]="label" for="bk-service">Service</label>
          <select id="bk-service" name="service" [class]="input" [ngModel]="serviceId()" (ngModelChange)="pickService($event)" required>
            @for (s of store.selectedServices(); track s.id) {
              <option [value]="s.id">{{ s.name }} · ₹{{ s.price }} · {{ s.duration }}m</option>
            }
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label [class]="label" for="bk-staff">Stylist</label>
            <select id="bk-staff" name="staff" [class]="input" [(ngModel)]="staffId" required>
              @for (s of store.staff(); track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </select>
          </div>
          <div>
            <label [class]="label" for="bk-date">Date</label>
            <input id="bk-date" name="date" type="date" [class]="input" [(ngModel)]="date" required />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label [class]="label" for="bk-time">Start time</label>
            <input id="bk-time" name="time" type="time" step="900" [class]="input" [(ngModel)]="time" required />
          </div>
          <div>
            <label [class]="label" for="bk-duration">Duration (mins)</label>
            <input id="bk-duration" name="duration" type="number" min="5" step="5" [class]="input" [(ngModel)]="duration" required />
          </div>
        </div>
        <div class="flex items-center justify-between pt-4 border-t border-outline-variant/20">
          <span class="font-headline-sm text-headline-sm text-on-surface">₹{{ price() }}</span>
          <div class="flex items-center gap-3">
            <button type="button" [class]="ghost" (click)="ui.closeBooking()">Cancel</button>
            <button type="submit" [class]="primary" [disabled]="f.invalid">Book appointment</button>
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

  submit() {
    const s = this.store.serviceById(this.serviceId());
    if (!s) return;
    const res = this.store.addBooking({
      date: this.date, staffId: this.staffId, client: this.client.trim(), phone: this.phone.trim() || '—',
      serviceName: s.name, start: toMin(this.time), duration: Number(this.duration), price: s.price, status: 'confirmed',
    });
    if (!res.ok) {
      this.toast.error(res.error ?? 'Could not create booking');
      return;
    }
    this.toast.success(`Booked ${this.client} with ${this.store.staffById(this.staffId)?.name}`);
    this.ui.closeBooking();
  }
}
