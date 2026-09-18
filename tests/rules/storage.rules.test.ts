import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const png = new Uint8Array([137, 80, 78, 71]);
const meta = { contentType: 'image/png' };

const owner = () => env.authenticatedContext('owner1', { role: 'owner', salonIds: ['s1'] }).storage();
const otherOwner = () => env.authenticatedContext('owner2', { role: 'owner', salonIds: ['s2'] }).storage();
const customer = () => env.authenticatedContext('c1').storage();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-chairly',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'salons/s1'), { ownerId: 'owner1' });
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), 'salons/s1/logo/existing.png'), png, meta);
  });
});
afterAll(() => env.cleanup());

describe('storage rules', () => {
  it('anyone can view a logo', async () => {
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), 'salons/s1/logo/existing.png')));
  });
  it('the owner can upload an image to their salon', async () => {
    await assertSucceeds(uploadBytes(ref(owner(), 'salons/s1/logo/new.png'), png, meta));
    await assertSucceeds(uploadBytes(ref(owner(), 'salons/s1/staff/vikram.png'), png, meta));
  });
  it('customers and other salons\' owners cannot upload', async () => {
    await assertFails(uploadBytes(ref(customer(), 'salons/s1/logo/x.png'), png, meta));
    await assertFails(uploadBytes(ref(otherOwner(), 'salons/s1/logo/x.png'), png, meta));
  });
  it('only images up to 5MB in allowed folders are accepted', async () => {
    await assertFails(uploadBytes(ref(owner(), 'salons/s1/logo/x.pdf'), png, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(owner(), 'salons/s1/logo/big.png'), new Uint8Array(5 * 1024 * 1024 + 1), meta));
    await assertFails(uploadBytes(ref(owner(), 'salons/s1/secrets/x.png'), png, meta));
  });
});
