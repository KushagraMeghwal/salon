// Local development: talks to the Firebase Emulator Suite (npm run emulators), so nothing touches real data.
// To test against the real project instead, set `useEmulators: false` and copy the `firebase` block
// from environment.ts.
export const environment = {
  production: false,
  // 'mock' keeps Razorpay simulated in the browser (until the app is wired to Firebase Auth + Firestore); 'live' calls the Cloud Functions.
  paymentsMode: 'mock' as 'mock' | 'live',
  useEmulators: true,
  firebase: {
    apiKey: 'demo-key',
    authDomain: 'demo-chairly.firebaseapp.com',
    projectId: 'demo-chairly',
    storageBucket: 'demo-chairly.appspot.com',
    messagingSenderId: '0',
    appId: 'demo-app',
    measurementId: '',
  },
  publicBaseUrl: 'http://localhost:4200',
};
