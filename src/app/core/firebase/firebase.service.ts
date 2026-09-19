import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { Functions, connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { environment } from '../../../environments/environment';

/**
 * Single place that creates the Firebase SDK instances from the environment file.
 * Created lazily on first inject, so screens that still use mock data never touch the network.
 * In development (`useEmulators`) everything points at the local Emulator Suite.
 *
 * No Firebase Storage: the Storage product was never enabled on the project (image uploads use
 * Cloudinary instead, see core/services/cloudinary.service.ts), and merely calling `getStorage()`
 * threw "Firebase Storage has not been set up on project ...".
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly db: Firestore;
  /** Cloud Functions gen2 live in asia-south1. */
  readonly functions: Functions;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.functions = getFunctions(this.app, 'asia-south1');

    if (environment.useEmulators) {
      connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(this.db, '127.0.0.1', 8080);
      connectFunctionsEmulator(this.functions, '127.0.0.1', 5001);
    }
  }
}
