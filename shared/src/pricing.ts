/**
 * Booking price. Prices are always GST-inclusive, so what a customer pays is the sum of the salon's own service
 * prices minus any coupon. The client shows this; the server recomputes it and is the only source of the charged amount.
 */
export interface PricedService {
  serviceId: string;
  name: string;
  price: number; // rupees, GST-inclusive
  duration: number; // minutes
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);

export function priceServices(services: readonly PricedService[]) {
  const price = services.reduce((a, s) => a + s.price, 0);
  const duration = services.reduce((a, s) => a + s.duration, 0);
  return { price, duration, amountPaise: toPaise(price) };
}

/** Discount can never exceed the subtotal or go negative. */
export const clampDiscount = (subtotal: number, discount: number) => Math.min(subtotal, Math.max(0, discount));
