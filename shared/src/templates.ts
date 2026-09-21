/**
 * Plain starter services (haircut, beard, waxing, massage, facial...) every new salon is seeded with (inactive until the owner switches a service on).
 * Ids are stable so the Angular onboarding screen can show the description and duration options.
 * This is a template, not tenant data: every salon gets its own copy under salons/{id}/services.
 */
export interface ServiceTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  durationOptions: number[];
}

export const SERVICE_TEMPLATES: readonly ServiceTemplate[] = [
  { id: 's1', name: 'Haircut', category: 'Hair', description: 'Wash, cut and style.', price: 300, duration: 30, durationOptions: [20, 30, 45, 60] },
  { id: 's2', name: 'Beard Trim', category: 'Beard & Shave', description: 'Trim and shape.', price: 150, duration: 20, durationOptions: [15, 20, 30] },
  { id: 's3', name: 'Shave', category: 'Beard & Shave', description: 'Clean shave with a hot towel.', price: 120, duration: 20, durationOptions: [15, 20, 30] },
  { id: 's4', name: 'Hair Colour', category: 'Coloring', description: 'Global or root colour.', price: 1200, duration: 60, durationOptions: [45, 60, 90, 120] },
  { id: 's5', name: 'Waxing', category: 'Waxing', description: 'Arms, legs or full body waxing.', price: 500, duration: 30, durationOptions: [15, 30, 45, 60] },
  { id: 's6', name: 'Threading', category: 'Waxing', description: 'Eyebrows, upper lip and face.', price: 60, duration: 15, durationOptions: [10, 15, 30] },
  { id: 's7', name: 'Facial', category: 'Facial & Skin', description: 'Cleanup or deep facial.', price: 800, duration: 45, durationOptions: [30, 45, 60, 75] },
  { id: 's8', name: 'Head Massage', category: 'Spa & Massage', description: 'Relaxing oil head massage.', price: 250, duration: 20, durationOptions: [15, 20, 30, 45] },
  { id: 's9', name: 'Body Massage', category: 'Spa & Massage', description: 'Full body relaxation massage.', price: 1500, duration: 60, durationOptions: [30, 45, 60, 90] },
  { id: 's10', name: 'Manicure', category: 'Nails', description: 'Nail shaping and care.', price: 400, duration: 30, durationOptions: [30, 45, 60] },
  { id: 's11', name: 'Pedicure', category: 'Nails', description: 'Foot care and polish.', price: 500, duration: 45, durationOptions: [30, 45, 60] },
];

export const DEFAULT_TIMINGS = Array.from({ length: 7 }, () => ({ open: true, start: '09:00', end: '21:00' }));
export const DEFAULT_BREAK = { enabled: true, start: '13:00', end: '14:00', blockSlots: true };

export const DEFAULT_SETTINGS = {
  allowPayAtSalon: true,
  requireOnlineAfterNoShows: true,
  noShowThreshold: 2,
  cancelWindowHrs: 2,
  latePenaltyPct: 15,
  hindiSupport: true,
  gstRegistered: false,
  gstin: '',
};

export const TRIAL_DAYS = 14;

/** URL slug from a salon name: "Luxe Grooming & Spa" -> "luxe-grooming-and-spa". */
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return s.length >= 3 ? s : 'salon-' + (s || 'studio');
}
