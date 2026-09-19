import { SERVICE_TEMPLATES } from '@chairly/shared';
import { Bill, Booking, CatalogService, CustomerRecord, QueueItem, StaffMember } from '../models';

/** Firestore Timestamp | Date | string -> ISO string ('' when missing). */
export function isoOf(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const t = v as { toDate?: () => Date };
  return typeof t.toDate === 'function' ? t.toDate().toISOString() : v instanceof Date ? v.toISOString() : '';
}

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function mapBooking(id: string, d: Doc): Booking {
  const lines: { serviceId?: string; name: string; price: number; duration: number }[] = (d['services'] ?? []).map(
    (s: Doc) => ({ serviceId: s['serviceId'], name: s['name'], price: s['price'], duration: s['duration'] }),
  );
  return {
    id,
    date: d['date'],
    staffId: d['staffId'],
    client: d['customerName'] ?? '',
    phone: d['customerPhone'] ?? '',
    customerPhone: String(d['customerPhone'] ?? '').replace(/\D/g, '').slice(-10),
    serviceName: lines.map((l) => l.name).join(' + '),
    start: d['start'],
    duration: d['duration'],
    price: d['price'],
    status: d['status'],
    notes: d['notes'],
    services: lines,
    payment: d['payment']?.mode,
    paid: d['payment']?.status === 'paid',
    bookingNo: d['bookingNo'],
    vip: d['vip'],
    source: d['source'] === 'owner' ? 'owner' : 'online',
    billed: !!d['billed'],
    salonId: d['salonId'],
    salonName: d['salonName'],
    salonSlug: d['salonSlug'],
    salonAddress: d['salonAddress'],
    staffName: d['staffName'],
  };
}

export function mapBill(id: string, d: Doc): Bill {
  return {
    no: d['invoiceNo'] ?? id,
    client: d['customerName'] ?? '',
    phone: d['customerPhone'] ?? '',
    lines: d['lines'] ?? [],
    subtotal: d['subtotal'] ?? 0,
    taxable: d['taxable'] ?? 0,
    cgst: d['cgst'] ?? 0,
    sgst: d['sgst'] ?? 0,
    gst: d['gst'] ?? 0,
    gstRegistered: !!d['gstRegistered'],
    gstin: d['gstin'],
    couponCode: d['couponCode'],
    discount: d['discount'] ?? 0,
    total: d['total'] ?? 0,
    method: d['method'],
    createdAt: isoOf(d['createdAt']),
    date: d['date'],
    bookingId: d['bookingId'],
  };
}

export function mapQueue(id: string, d: Doc): QueueItem {
  return {
    id,
    stage: d['stage'],
    client: d['client'] ?? '',
    phone: d['phone'] ?? '',
    service: d['service'] ?? '',
    category: d['category'] ?? 'Hair',
    price: d['price'] ?? 0,
    duration: d['duration'] ?? 0,
    requestedStaffId: d['requestedStaffId'] ?? null,
    staffId: d['staffId'] ?? null,
    station: d['station'] ?? null,
    source: d['source'] ?? 'walkin',
    arrivedAt: d['arrivedAt'] ?? 0,
    startedAt: d['startedAt'] ?? null,
    billNo: d['billNo'],
    payMethod: d['payMethod'],
    billedAt: d['billedAt'],
  };
}

export function mapCustomer(id: string, d: Doc): CustomerRecord {
  return {
    id,
    uid: d['uid'] ?? null,
    name: d['name'] ?? '',
    phone: d['phone'] ?? '',
    visits: d['visits'] ?? 0,
    totalSpent: d['totalSpent'] ?? 0,
    lastVisit: d['lastVisit'] ?? '',
    noShowCount: d['noShowCount'] ?? 0,
  };
}

/** Duration choices offered in the catalogue editor for a service without a template. */
export function durationChoices(duration: number): number[] {
  return [...new Set([15, 30, 45, 60, 90, 120, duration])].sort((a, b) => a - b);
}

export function mapService(id: string, d: Doc): CatalogService {
  const tpl = SERVICE_TEMPLATES.find((t) => t.id === id);
  return {
    id,
    name: d['name'],
    category: d['category'] ?? 'Hair',
    description: d['description'] ?? '',
    suggestedPrice: tpl?.price ?? d['price'],
    suggestedDuration: tpl?.duration ?? d['duration'],
    durationOptions: tpl ? [...new Set([...tpl.durationOptions, d['duration']])].sort((a, b) => a - b) : durationChoices(d['duration']),
    selected: d['active'] !== false,
    price: d['price'],
    duration: d['duration'],
    custom: !!d['custom'],
  };
}

export function mapStaff(id: string, d: Doc, priv?: Doc): StaffMember {
  return {
    id,
    name: d['name'] ?? '',
    role: d['role'] ?? 'Stylist',
    title: d['title'] ?? d['role'] ?? '',
    phone: priv?.['phone'] ?? '',
    email: priv?.['email'] ?? '',
    serviceIds: d['serviceIds'] ?? [],
    days: d['days'] ?? [true, true, true, true, true, true, false],
    commission: priv?.['commission'] ?? 0,
    photo: d['photoUrl'] ?? null,
    status: d['status'] === 'on-duty' ? 'on-duty' : 'off',
  };
}
