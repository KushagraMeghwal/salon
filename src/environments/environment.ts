// Production build: talks to the real Firebase project "salon-79da5".
// A Firebase web apiKey only identifies the project; access is enforced by firestore.rules / storage.rules.
// Real secrets (payment keys, webhook secrets) belong in Cloud Functions config, never here.
export const environment = {
  production: true,
  useEmulators: false,
  firebase: {
    apiKey: 'AIzaSyC4qSQuejbkm_A4v3DDAX7wpFQw3AL-s-0',
    authDomain: 'salon-79da5.firebaseapp.com',
    projectId: 'salon-79da5',
    storageBucket: 'salon-79da5.firebasestorage.app',
    messagingSenderId: '730220142825',
    appId: '1:730220142825:web:9aa581d965240ee82bd078',
    measurementId: 'G-2VB4B0JE71',
  },
  publicBaseUrl: 'https://chairly.app',
};
