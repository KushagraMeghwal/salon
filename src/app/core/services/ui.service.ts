import { Injectable, signal } from '@angular/core';

export interface BookingPrefill {
  date?: string;
  staffId?: string;
  start?: number;
}

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly bookingModal = signal<BookingPrefill | null>(null);
  readonly walkInModal = signal(false);
  readonly navOpen = signal(false);

  openBooking(prefill: BookingPrefill = {}) {
    this.bookingModal.set(prefill);
  }
  closeBooking() {
    this.bookingModal.set(null);
  }
}
