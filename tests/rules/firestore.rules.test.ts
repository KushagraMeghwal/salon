import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, collection } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const SALON = 's1';
let env: RulesTestEnvironment;

const salonDoc = (over: Record<string, unknown> = {}) => ({
  ownerId: 'owner1', status: 'active', bookable: true, slug: 'luxe',
  profile: { name: 'Luxe Studio' },
  settings: { allowPayAtSalon: true, requireOnlineAfterNoShows: true, noShowThreshold: 2, cancelWindowHrs: 2, latePenaltyPct: 15, gstRegistered: false, gstin: '' },
  ...over,
});
const service = { name: 'Haircut', category: 'Hair', price: 450, duration: 45, active: true };
const staffPublic = { name: 'Vikram', serviceIds: ['s1'], days: [true, true, true, true, true, true, false], active: true };

const anon = () => env.unauthenticatedContext().firestore();
const customer = (id = 'c1') => env.authenticatedContext(id).firestore();
const owner = () => env.authenticatedContext('owner1', { role: 'owner', salonIds: [SALON] }).firestore();
const otherOwner = () => env.authenticatedContext('owner2', { role: 'owner', salonIds: ['s2'] }).firestore();
const stylist = (staffId = 'stf1') => env.authenticatedContext('stylist1', { role: 'staff', salonIds: [SALON], staffId }).firestore();
const admin = () => env.authenticatedContext('root', { role: 'superadmin' }).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-chairly',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `salons/${SALON}`), salonDoc());
    await setDoc(doc(db, `salons/${SALON}/services/sv1`), service);
    await setDoc(doc(db, `salons/${SALON}/staff/stf1`), staffPublic);
    await setDoc(doc(db, `salons/${SALON}/staffPrivate/stf1`), { commission: 15, phone: '+91 98201 44521' });
    await setDoc(doc(db, `salons/${SALON}/staffPrivate/stf2`), { commission: 12, phone: '+91 98234 56789' });
    await setDoc(doc(db, `salons/${SALON}/staffStats/stf1`), { revenue: 1000 });
    await setDoc(doc(db, `salons/${SALON}/private/payout`), { bankName: 'HDFC' });
    await setDoc(doc(db, `salons/${SALON}/private/billing`), { plan: 'pro' });
    await setDoc(doc(db, `salons/${SALON}/bills/bl1`), { total: 500 });
    await setDoc(doc(db, `salons/${SALON}/customers/c1`), { noShowCount: 1 });
    await setDoc(doc(db, `salons/${SALON}/bookings/b1`), { customerId: 'c1', staffId: 'stf1', date: '2026-10-01' });
    await setDoc(doc(db, `salons/${SALON}/bookings/b2`), { customerId: 'c2', staffId: 'stf2', date: '2026-10-01' });
    await setDoc(doc(db, 'slugs/luxe'), { salonId: SALON });
    await setDoc(doc(db, 'users/c1'), { role: 'customer', salonIds: [], noShowCount: 0, name: 'Ananya' });
  });
});

describe('public browsing', () => {
  it('anyone can read a salon, its services, stylists and slug', async () => {
    await assertSucceeds(getDoc(doc(anon(), `salons/${SALON}`)));
    await assertSucceeds(getDoc(doc(anon(), `salons/${SALON}/services/sv1`)));
    await assertSucceeds(getDoc(doc(anon(), `salons/${SALON}/staff/stf1`)));
    await assertSucceeds(getDoc(doc(anon(), 'slugs/luxe')));
  });
  it('salons and slugs cannot be listed by the public', async () => {
    await assertFails(getDocs(collection(anon(), 'salons')));
    await assertFails(getDocs(collection(anon(), 'slugs')));
  });
  it('private salon data is never public', async () => {
    await assertFails(getDoc(doc(anon(), `salons/${SALON}/staffPrivate/stf1`)));
    await assertFails(getDoc(doc(customer(), `salons/${SALON}/private/payout`)));
    await assertFails(getDoc(doc(customer(), `salons/${SALON}/bills/bl1`)));
  });
});

describe('users', () => {
  it('a user can register only as a customer with zero no-shows', async () => {
    await assertSucceeds(setDoc(doc(customer('new'), 'users/new'), { role: 'customer', salonIds: [], noShowCount: 0, name: 'N' }));
    await assertFails(setDoc(doc(customer('new2'), 'users/new2'), { role: 'owner', salonIds: [], noShowCount: 0 }));
    await assertFails(setDoc(doc(customer('new3'), 'users/new3'), { role: 'customer', salonIds: ['s1'], noShowCount: 0 }));
  });
  it('a user cannot promote themselves or reset their no-show count', async () => {
    await assertFails(updateDoc(doc(customer('c1'), 'users/c1'), { role: 'superadmin' }));
    await assertFails(updateDoc(doc(customer('c1'), 'users/c1'), { noShowCount: 0, salonIds: ['s1'] }));
    await assertSucceeds(updateDoc(doc(customer('c1'), 'users/c1'), { name: 'Ananya R' }));
  });
  it('users cannot read other profiles; superadmin can', async () => {
    await assertFails(getDoc(doc(customer('c2'), 'users/c1')));
    await assertSucceeds(getDoc(doc(admin(), 'users/c1')));
  });
});

describe('salon ownership', () => {
  it('a signed-in user can create a draft salon they own, but not an active one or for someone else', async () => {
    await assertSucceeds(setDoc(doc(customer('u9'), 'salons/new'), salonDoc({ ownerId: 'u9', status: 'draft', bookable: false })));
    await assertFails(setDoc(doc(customer('u9'), 'salons/new2'), salonDoc({ ownerId: 'u9', status: 'active' })));
    await assertFails(setDoc(doc(customer('u9'), 'salons/new3'), salonDoc({ ownerId: 'someoneElse', status: 'draft', bookable: false })));
    await assertFails(setDoc(doc(anon(), 'salons/new4'), salonDoc({ ownerId: 'x', status: 'draft', bookable: false })));
  });
  it('owner can edit profile but not status, slug, ownerId or bookable', async () => {
    await assertSucceeds(updateDoc(doc(owner(), `salons/${SALON}`), { 'profile.name': 'Luxe Studio 2' }));
    await assertFails(updateDoc(doc(owner(), `salons/${SALON}`), { status: 'suspended' }));
    await assertFails(updateDoc(doc(owner(), `salons/${SALON}`), { slug: 'hijack' }));
    await assertFails(updateDoc(doc(owner(), `salons/${SALON}`), { ownerId: 'me' }));
    await assertFails(updateDoc(doc(owner(), `salons/${SALON}`), { bookable: false }));
  });
  it('owner rejects invalid policy values', async () => {
    await assertFails(updateDoc(doc(owner(), `salons/${SALON}`), { 'settings.latePenaltyPct': 500 }));
    await assertFails(updateDoc(doc(owner(), `salons/${SALON}`), { 'settings.noShowThreshold': 0 }));
  });
  it('GST: registered salons need a valid GSTIN, unregistered can leave it empty', async () => {
    const ref = doc(owner(), `salons/${SALON}`);
    await assertFails(updateDoc(ref, { 'settings.gstRegistered': true }));
    await assertFails(updateDoc(ref, { 'settings.gstRegistered': true, 'settings.gstin': '12ABC' }));
    await assertSucceeds(updateDoc(ref, { 'settings.gstRegistered': true, 'settings.gstin': '27ABCDE1234F1Z5' }));
    await assertSucceeds(updateDoc(ref, { 'settings.gstRegistered': false, 'settings.gstin': '' }));
  });
  it("another salon's owner and a customer cannot edit this salon", async () => {
    await assertFails(updateDoc(doc(otherOwner(), `salons/${SALON}`), { 'profile.name': 'Pwned' }));
    await assertFails(updateDoc(doc(customer(), `salons/${SALON}`), { 'profile.name': 'Pwned' }));
  });
  it('superadmin can suspend a salon', async () => {
    await assertSucceeds(updateDoc(doc(admin(), `salons/${SALON}`), { status: 'suspended' }));
  });
  it('owners can list only their own salons', async () => {
    await assertSucceeds(getDocs(query(collection(owner(), 'salons'), where('ownerId', '==', 'owner1'))));
    await assertFails(getDocs(query(collection(owner(), 'salons'), where('ownerId', '==', 'owner2'))));
    await assertSucceeds(getDocs(collection(admin(), 'salons')));
  });
});

describe('services and staff', () => {
  it('owner can manage services with valid data only', async () => {
    await assertSucceeds(setDoc(doc(owner(), `salons/${SALON}/services/sv2`), { ...service, name: 'Beard Trim' }));
    await assertFails(setDoc(doc(owner(), `salons/${SALON}/services/sv3`), { ...service, price: -5 }));
    await assertFails(setDoc(doc(owner(), `salons/${SALON}/services/sv4`), { ...service, duration: 1 }));
    await assertFails(setDoc(doc(owner(), `salons/${SALON}/services/sv5`), { ...service, isAdmin: true }));
  });
  it('customers, stylists and other owners cannot change services', async () => {
    await assertFails(setDoc(doc(customer(), `salons/${SALON}/services/x`), service));
    await assertFails(setDoc(doc(stylist(), `salons/${SALON}/services/x`), service));
    await assertFails(setDoc(doc(otherOwner(), `salons/${SALON}/services/x`), service));
    await assertFails(deleteDoc(doc(customer(), `salons/${SALON}/services/sv1`)));
  });
  it('commission must be 0-100 and is visible only to the owner and that stylist', async () => {
    await assertSucceeds(setDoc(doc(owner(), `salons/${SALON}/staffPrivate/stf3`), { commission: 20, phone: '+91 9' }));
    await assertFails(setDoc(doc(owner(), `salons/${SALON}/staffPrivate/stf4`), { commission: 150, phone: '+91 9' }));
    await assertSucceeds(getDoc(doc(stylist('stf1'), `salons/${SALON}/staffPrivate/stf1`)));
    await assertFails(getDoc(doc(stylist('stf1'), `salons/${SALON}/staffPrivate/stf2`)));
    await assertFails(getDoc(doc(customer(), `salons/${SALON}/staffPrivate/stf1`)));
  });
  it('stats are read-only: readable by owner and the stylist, never writable', async () => {
    await assertSucceeds(getDoc(doc(owner(), `salons/${SALON}/staffStats/stf1`)));
    await assertSucceeds(getDoc(doc(stylist('stf1'), `salons/${SALON}/staffStats/stf1`)));
    await assertFails(getDoc(doc(customer(), `salons/${SALON}/staffStats/stf1`)));
    await assertFails(setDoc(doc(owner(), `salons/${SALON}/staffStats/stf1`), { revenue: 9e9 }));
  });
});

describe('bookings', () => {
  it('a customer reads only their own booking', async () => {
    await assertSucceeds(getDoc(doc(customer('c1'), `salons/${SALON}/bookings/b1`)));
    await assertFails(getDoc(doc(customer('c1'), `salons/${SALON}/bookings/b2`)));
    await assertFails(getDoc(doc(anon(), `salons/${SALON}/bookings/b1`)));
  });
  it('a customer can query their bookings across salons, but not someone else\'s', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(customer('c1'), 'bookings'), where('customerId', '==', 'c1'))));
    await assertFails(getDocs(query(collectionGroup(customer('c1'), 'bookings'), where('customerId', '==', 'c2'))));
  });
  it('owner reads all; a stylist reads only their own bookings', async () => {
    await assertSucceeds(getDoc(doc(owner(), `salons/${SALON}/bookings/b2`)));
    await assertSucceeds(getDoc(doc(stylist('stf1'), `salons/${SALON}/bookings/b1`)));
    await assertFails(getDoc(doc(stylist('stf1'), `salons/${SALON}/bookings/b2`)));
    await assertFails(getDoc(doc(otherOwner(), `salons/${SALON}/bookings/b1`)));
  });
  it('nobody can write bookings from the client (functions only)', async () => {
    const data = { customerId: 'c1', staffId: 'stf1', date: '2026-10-02' };
    await assertFails(setDoc(doc(customer('c1'), `salons/${SALON}/bookings/new`), data));
    await assertFails(setDoc(doc(owner(), `salons/${SALON}/bookings/new`), data));
    await assertFails(updateDoc(doc(customer('c1'), `salons/${SALON}/bookings/b1`), { status: 'cancelled' }));
    await assertFails(deleteDoc(doc(admin(), `salons/${SALON}/bookings/b1`)));
  });
});

describe('billing, customers, payouts and locks', () => {
  it('bills, billing and payout data are owner/superadmin only and bills are read-only', async () => {
    await assertSucceeds(getDoc(doc(owner(), `salons/${SALON}/bills/bl1`)));
    await assertFails(getDoc(doc(stylist(), `salons/${SALON}/bills/bl1`)));
    await assertFails(setDoc(doc(owner(), `salons/${SALON}/bills/new`), { total: 1 }));
    await assertSucceeds(setDoc(doc(owner(), `salons/${SALON}/private/payout`), { bankName: 'ICICI' }));
    await assertFails(setDoc(doc(owner(), `salons/${SALON}/private/billing`), { plan: 'free-forever' }));
    await assertSucceeds(setDoc(doc(admin(), `salons/${SALON}/private/billing`), { plan: 'pro' }));
  });
  it('customer records: owner reads all, customers only their own, no one writes', async () => {
    await assertSucceeds(getDoc(doc(owner(), `salons/${SALON}/customers/c1`)));
    await assertSucceeds(getDoc(doc(customer('c1'), `salons/${SALON}/customers/c1`)));
    await assertFails(getDoc(doc(customer('c2'), `salons/${SALON}/customers/c1`)));
    await assertFails(updateDoc(doc(customer('c1'), `salons/${SALON}/customers/c1`), { noShowCount: 0 }));
  });
  it('availability locks are never client accessible', async () => {
    await assertFails(getDoc(doc(owner(), `salons/${SALON}/staffDays/stf1_2026-10-01`)));
    await assertFails(setDoc(doc(admin(), `salons/${SALON}/staffDays/stf1_2026-10-01`), { busy: [] }));
  });
});

describe('platform', () => {
  it('plans are public to read and superadmin-only to write', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'plans/pro')));
    await assertFails(setDoc(doc(owner(), 'plans/pro'), { price: 1 }));
    await assertSucceeds(setDoc(doc(admin(), 'plans/pro'), { price: 1999 }));
  });
  it('platform stats are superadmin-only and read-only', async () => {
    await assertFails(getDoc(doc(owner(), 'platform/stats')));
    await assertSucceeds(getDoc(doc(admin(), 'platform/stats')));
    await assertFails(setDoc(doc(admin(), 'platform/stats'), { x: 1 }));
  });
});
