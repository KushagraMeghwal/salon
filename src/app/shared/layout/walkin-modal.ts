import { TranslatePipe } from '@ngx-translate/core';
import { Component, effect, inject, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SalonStore } from '../../core/services/salon.store';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL } from '../ui/form-classes';
import { Modal } from '../ui/modal';

@Component({
  selector: 'app-walkin-modal',
  imports: [FormsModule, Modal, TranslatePipe],
  template: `
    <app-modal [open]="ui.walkInModal()" [title]="'Add Walk-in' | translate" (closed)="ui.walkInModal.set(false)">
      <form class="space-y-4" (ngSubmit)="submit()" #f="ngForm">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label [class]="label" for="wi-name">{{ "Client name" | translate }}</label>
            <input id="wi-name" name="name" [class]="input" [(ngModel)]="name" required [placeholder]="'e.g., Amit Saxena' | translate" />
          </div>
          <div>
            <label [class]="label" for="wi-phone">{{ "Mobile number" | translate }}</label>
            <input id="wi-phone" name="phone" [class]="input" [(ngModel)]="phone" [placeholder]="'Optional' | translate" />
          </div>
        </div>
        <div>
          <label [class]="label" for="wi-service">{{ "Service" | translate }}</label>
          <select id="wi-service" name="service" [class]="input" [(ngModel)]="serviceId" required>
            @for (s of store.selectedServices(); track s.id) {
              <option [value]="s.id">{{ s.name }} · ₹{{ s.price }}</option>
            }
          </select>
        </div>
        <div>
          <label [class]="label" for="wi-staff">{{ "Preferred stylist" | translate }}</label>
          <select id="wi-staff" name="staff" [class]="input" [(ngModel)]="staffId">
            <option value="">{{ "Any stylist" | translate }}</option>
            @for (s of store.staff(); track s.id) {
              <option [value]="s.id">{{ s.name }}</option>
            }
          </select>
        </div>
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20">
          <button type="button" [class]="ghost" (click)="ui.walkInModal.set(false)">{{ "Cancel" | translate }}</button>
          <button type="submit" [class]="primary" [disabled]="f.invalid">{{ "Add to queue" | translate }}</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class WalkinModal {
  protected readonly ui = inject(UiService);
  protected readonly store = inject(SalonStore);
  private readonly toast = inject(ToastService);
  protected readonly input = INPUT;
  protected readonly label = LABEL;
  protected readonly primary = BTN_PRIMARY;
  protected readonly ghost = BTN_GHOST;

  name = '';
  phone = '';
  serviceId = '';
  staffId = '';

  constructor() {
    effect(() => {
      if (!this.ui.walkInModal()) return;
      untracked(() => {
        this.name = '';
        this.phone = '';
        this.staffId = '';
        this.serviceId = this.store.selectedServices()[0]?.id ?? '';
      });
    });
  }

  submit() {
    this.store.addWalkIn(this.name.trim(), this.phone.trim(), this.serviceId, this.staffId || null);
    this.toast.success('{{p1}} added to the waiting queue', { p1: this.name });
    this.ui.walkInModal.set(false);
  }
}
