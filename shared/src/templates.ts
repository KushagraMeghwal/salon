/**
 * Starter catalogue every new salon is seeded with (inactive until the owner switches a service on).
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
  { id: 's1', name: 'Signature Haircut & Styling', category: 'Hair', description: 'Consultation, hair wash, precision cut and blow-dry styling.', price: 450, duration: 45, durationOptions: [30, 45, 60] },
  { id: 's2', name: 'Beard Trim & Shape', category: 'Beard & Shave', description: 'Precision edge styling, trimming and a warm towel freshener.', price: 250, duration: 25, durationOptions: [15, 25, 30] },
  { id: 's3', name: 'Keratin Hair Treatment', category: 'Hair', description: 'Anti-frizz smoothing protein treatment for long-lasting shine.', price: 2800, duration: 90, durationOptions: [90, 120] },
  { id: 's4', name: 'Hydra-Glow Facial', category: 'Facial & Skin', description: 'Deep hydration, botanical scrub exfoliation and a brightening mask.', price: 1500, duration: 60, durationOptions: [45, 60, 75] },
  { id: 's5', name: 'Head Massage & Aromatherapy', category: 'Spa & Massage', description: 'Herbal oil massage focusing on temples, neck and shoulder relief.', price: 600, duration: 30, durationOptions: [20, 30, 45] },
  { id: 's6', name: 'Classic Charcoal Detan', category: 'Facial & Skin', description: 'Active charcoal peel to remove tan, dirt and pollution impurities.', price: 350, duration: 20, durationOptions: [20, 30] },
  { id: 's7', name: 'Beard Spa & Hot Towel', category: 'Beard & Shave', description: 'Deep conditioning treatment with essential oils and steam towel wraps.', price: 400, duration: 30, durationOptions: [30, 45] },
  { id: 's8', name: 'Hair Root Touchup', category: 'Coloring', description: 'Ammonia-free grey coverage along the hairline and parting.', price: 950, duration: 45, durationOptions: [30, 45, 60] },
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
