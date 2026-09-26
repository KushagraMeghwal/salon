/** States and union territories as [code, name]; salons store the code. */
export const INDIAN_STATES: [string, string][] = [
  ['AN', 'Andaman and Nicobar Islands'], ['AP', 'Andhra Pradesh'], ['AR', 'Arunachal Pradesh'], ['AS', 'Assam'], ['BR', 'Bihar'],
  ['CH', 'Chandigarh'], ['CG', 'Chhattisgarh'], ['DN', 'Dadra and Nagar Haveli and Daman and Diu'], ['DL', 'Delhi NCR'], ['GA', 'Goa'],
  ['GJ', 'Gujarat'], ['HR', 'Haryana'], ['HP', 'Himachal Pradesh'], ['JK', 'Jammu and Kashmir'], ['JH', 'Jharkhand'],
  ['KA', 'Karnataka'], ['KL', 'Kerala'], ['LA', 'Ladakh'], ['LD', 'Lakshadweep'], ['MP', 'Madhya Pradesh'],
  ['MH', 'Maharashtra'], ['MN', 'Manipur'], ['ML', 'Meghalaya'], ['MZ', 'Mizoram'], ['NL', 'Nagaland'],
  ['OD', 'Odisha'], ['PY', 'Puducherry'], ['PB', 'Punjab'], ['RJ', 'Rajasthan'], ['SK', 'Sikkim'],
  ['TN', 'Tamil Nadu'], ['TS', 'Telangana'], ['TR', 'Tripura'], ['UP', 'Uttar Pradesh'], ['UK', 'Uttarakhand'],
  ['WB', 'West Bengal'],
];

export const PHONE_OK = (v: string) => v.replace(/\D/g, '').length === 10;
export const EMAIL_OK = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const PIN_OK = (v: string) => !v || /^[1-9]\d{5}$/.test(v);

/** tel: link for an Indian mobile stored as 10 digits (or already with a country code). */
export function telHref(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '');
  if (!d) return '';
  return 'tel:+' + (d.length === 10 ? '91' + d : d);
}

/** WhatsApp chat link for the same number. */
export function waHref(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '');
  if (!d) return '';
  return 'https://wa.me/' + (d.length === 10 ? '91' + d : d);
}

/** "98765 43210" for display. */
export function prettyPhone(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : (phone ?? '');
}
