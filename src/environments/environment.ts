// Production build: talks to the real Firebase project "salon-79da5".
// A Firebase web apiKey only identifies the project; access is enforced by firestore.rules.
// Real secrets (payment keys, webhook secrets) belong in Cloud Functions config, never here.
// No Firebase Storage: it was never enabled on this project. Logos and staff photos upload to
// Cloudinary instead (see core/services/cloudinary.service.ts).
export const environment = {
  production: true,
  // 'mock' keeps Razorpay simulated in the browser (until the app is wired to Firebase Auth + Firestore); 'live' calls the Cloud Functions.
  paymentsMode: 'mock' as 'mock' | 'live',
  useEmulators: false,
  firebase: {
    apiKey: 'AIzaSyC4qSQuejbkm_A4v3DDAX7wpFQw3AL-s-0',
    authDomain: 'salon-79da5.firebaseapp.com',
    projectId: 'salon-79da5',
    messagingSenderId: '730220142825',
    appId: '1:730220142825:web:9aa581d965240ee82bd078',
    measurementId: 'G-2VB4B0JE71',
  },
  // The working, deployed origin (Firebase Hosting's own domain). chairly.app is the intended
  // custom domain but is not connected/verified on Firebase Hosting yet — links built from it
  // don't resolve. Switch this back once chairly.app is added and verified under Hosting settings.
  publicBaseUrl: 'https://salon-79da5.web.app',
};
