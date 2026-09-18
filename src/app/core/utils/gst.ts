/** Prices are always GST-inclusive. When the salon is GST registered, bills show the tax inside the price. */
export const GST_RATE = 18;

export interface GstSplit {
  taxable: number;
  cgst: number;
  sgst: number;
  gst: number;
}

/** Splits a GST-inclusive amount into taxable value and CGST + SGST (equal halves). */
export function splitGst(inclusiveTotal: number, registered: boolean): GstSplit {
  if (!registered || inclusiveTotal <= 0) return { taxable: inclusiveTotal, cgst: 0, sgst: 0, gst: 0 };
  const taxable = Math.round((inclusiveTotal * 100) / (100 + GST_RATE));
  const gst = inclusiveTotal - taxable;
  const cgst = Math.round(gst / 2);
  return { taxable, cgst, sgst: gst - cgst, gst };
}

/** Indian GSTIN: 2-digit state code, 10-char PAN, entity number, "Z", check character. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
