/**
 * Server-side booking price. Prices are always GST-inclusive (see src/app/core/utils/gst.ts), so the amount the
 * customer pays is simply the sum of the salon's own service prices. The client never sends an amount.
 * This is the seed of the shared pricing module planned for Phase 4; keep it free of Firebase imports so it can
 * be shared with the Angular app later.
 */
export interface PricedService {
  serviceId: string;
  name: string;
  price: number; // rupees, GST-inclusive
  duration: number; // minutes
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);

export function priceServices(services: PricedService[]) {
  const price = services.reduce((a, s) => a + s.price, 0);
  const duration = services.reduce((a, s) => a + s.duration, 0);
  return { price, duration, amountPaise: toPaise(price) };
}
