import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import {
  ConfirmationResult, GoogleAuthProvider, RecaptchaVerifier, User, createUserWithEmailAndPassword, onAuthStateChanged,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPhoneNumber, signInWithPopup, signInWithRedirect, signOut as fbSignOut, updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../firebase/firebase.service';
import { CustomerSession, Role } from '../models';
import { SalonStore } from './salon.store';

export interface Claims {
  role: Role;
  salonIds: string[];
  staffId?: string;
}

export interface SessionResult {
  role: 'owner' | 'superadmin' | 'staff' | 'customer';
  salonId: string | null;
  status: string | null;
  slug: string | null;
}

/** Plain-language text for Firebase Auth errors; raw codes never reach the UI. */
export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-phone-number': 'Enter a valid 10-digit mobile number.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/invalid-verification-code': "That code isn't right. Please try again.",
    'auth/code-expired': 'That code has expired. Please request a new one.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Please allow pop-ups and try again.',
    'auth/network-request-failed': 'No internet connection. Please check and try again.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled yet.',
    'auth/unauthorized-domain': 'This website address is not authorised for sign-in yet.',
  };
  if (map[code]) return map[code];
  const msg = (e as { message?: string })?.message ?? '';
  return code.startsWith('functions/') && msg && !/internal/i.test(msg) ? msg : 'Something went wrong. Please try again.';
}

/**
 * Real Firebase Auth for all three audiences. Roles live in the ID token's custom claims (set only by Cloud
 * Functions), so the UI and the security rules read the same source of truth.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly fb = inject(FirebaseService);
  private readonly injector = inject(Injector);
  private confirmation: ConfirmationResult | null = null;
  private verifier: RecaptchaVerifier | null = null;

  readonly user = signal<User | null>(null);
  readonly claims = signal<Claims>({ role: 'customer', salonIds: [] });
  /** Phone / name the customer saved on their own profile (Google accounts have no phone until they add one). */
  private readonly saved = signal<{ name: string; phone: string }>({ name: '', phone: '' });
  /** Resolves once Firebase has restored (or ruled out) a saved session. Guards wait on it. */
  readonly ready: Promise<void>;

  readonly role = computed<Role>(() => (this.user() ? this.claims().role : 'customer'));
  readonly salonId = computed(() => this.claims().salonIds[0] ?? null);
  readonly staffId = computed(() => this.claims().staffId ?? '');

  /** Shape the customer pages already use. null while signed out. */
  readonly customer = computed<CustomerSession | null>(() => {
    const u = this.user();
    if (!u) return null;
    const digits = (u.phoneNumber ?? '').replace(/\D/g, '').slice(-10) || this.saved().phone;
    return { phone: digits, name: this.saved().name || u.displayName || '', noShowCount: 0 };
  });

  /** Signed-in person for headers (owner sidebar etc.). */
  readonly profile = computed(() => {
    const u = this.user();
    const role = this.role();
    return {
      name: u?.displayName || this.saved().name || u?.email?.split('@')[0] || u?.phoneNumber || 'Owner',
      title: role === 'superadmin' ? 'Platform admin' : role === 'staff' ? 'Stylist' : 'Salon Owner',
      email: u?.email ?? '',
      photo: u?.photoURL ?? null,
    };
  });

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      onAuthStateChanged(this.fb.auth, async (u) => {
        this.user.set(u);
        try {
          if (u) await this.readClaims(u);
          else {
            this.claims.set({ role: 'customer', salonIds: [] });
            this.saved.set({ name: '', phone: '' });
          }
        } finally {
          resolve();
        }
      });
    });
  }

  // ---------- sign-in methods ----------
  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(this.fb.auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Some in-app browsers cannot open pop-ups; fall back to a full-page redirect.
      if (code === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(this.fb.auth, provider);
      throw e;
    }
    await this.afterSignIn();
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.fb.auth, email.trim(), password);
    await this.afterSignIn();
  }

  async signUpWithEmail(name: string, email: string, password: string): Promise<void> {
    const cred = await createUserWithEmailAndPassword(this.fb.auth, email.trim(), password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
    await this.afterSignIn();
  }

  resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(this.fb.auth, email.trim());
  }

  /** Sends the SMS code. `container` is the id of an empty element the invisible reCAPTCHA attaches to. */
  async sendPhoneCode(phone10: string, container: string): Promise<void> {
    this.verifier?.clear();
    this.verifier = new RecaptchaVerifier(this.fb.auth, container, { size: 'invisible' });
    try {
      this.confirmation = await signInWithPhoneNumber(this.fb.auth, `+91${phone10}`, this.verifier);
    } catch (e) {
      this.verifier.clear();
      this.verifier = null;
      throw e;
    }
  }

  async confirmPhoneCode(code: string): Promise<void> {
    if (!this.confirmation) throw { code: 'auth/code-expired' };
    await this.confirmation.confirm(code);
    await this.afterSignIn();
  }

  async signOut(): Promise<void> {
    await fbSignOut(this.fb.auth);
    // Lazy lookup: the store must not stay loaded with one salon's data for the next person on this device.
    this.injector.get(SalonStore).reset();
  }

  // ---------- roles ----------
  /** Refreshes the token so newly issued claims are visible, then re-reads them. */
  async readClaims(u: User | null = this.user(), force = false): Promise<void> {
    if (!u) return;
    const t = await u.getIdTokenResult(force);
    const c = t.claims as { role?: Role; salonIds?: string[]; staffId?: string };
    this.claims.set({ role: c.role ?? 'customer', salonIds: c.salonIds ?? [], staffId: c.staffId });
    await this.loadSaved(u);
  }

  private async callAndRefresh<T>(name: string, data?: unknown): Promise<T> {
    const res = await httpsCallable<unknown, T>(this.fb.functions, name)(data);
    await this.readClaims(this.user(), true);
    return res.data;
  }

  /** Owner sign-up / login: creates the salon on first use and grants the owner (or platform admin) role. */
  registerOwner(): Promise<SessionResult> {
    return this.callAndRefresh<SessionResult>('registerOwner');
  }

  /** Stylist login: matches the signed-in mobile number to a stylist a salon has added. */
  claimStaff(): Promise<{ salonId: string; staffId: string }> {
    return this.callAndRefresh('claimStaffAccess');
  }

  // ---------- customer profile ----------
  private async afterSignIn() {
    const u = this.user();
    if (!u) return;
    await this.readClaims(u);
    if (this.claims().role === 'customer') await this.ensureUserDoc(u);
  }

  private async loadSaved(u: User) {
    try {
      const snap = await getDoc(doc(this.fb.db, `users/${u.uid}`));
      const d = snap.data();
      this.saved.set({ name: d?.['name'] ?? '', phone: String(d?.['phone'] ?? '').replace(/\D/g, '').slice(-10) });
    } catch {
      /* offline: fall back to the Auth profile */
    }
  }

  /** "Save the user": every customer has a users/{uid} document from their first sign-in. */
  private async ensureUserDoc(u: User) {
    const ref = doc(this.fb.db, `users/${u.uid}`);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          name: u.displayName ?? '', phone: u.phoneNumber ?? '', email: u.email ?? '', role: 'customer', salonIds: [], noShowCount: 0, createdAt: serverTimestamp(),
        });
      }
      await this.loadSaved(u);
    } catch {
      /* the booking flow asks for name and phone again if this could not be saved */
    }
  }

  async setCustomerName(name: string) {
    const u = this.user();
    if (!u || !name.trim()) return;
    this.saved.update((s) => ({ ...s, name: name.trim() }));
    try {
      await updateProfile(u, { displayName: name.trim() });
      await updateDoc(doc(this.fb.db, `users/${u.uid}`), { name: name.trim(), updatedAt: serverTimestamp() });
    } catch {
      /* kept locally for this session */
    }
  }

  async setCustomerPhone(phone: string) {
    const u = this.user();
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!u || digits.length !== 10) return;
    this.saved.update((s) => ({ ...s, phone: digits }));
    try {
      await updateDoc(doc(this.fb.db, `users/${u.uid}`), { phone: digits, updatedAt: serverTimestamp() });
    } catch {
      /* kept locally for this session */
    }
  }
}
