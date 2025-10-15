import admin from 'firebase-admin';

const initializeFirebaseAdmin = () => {
  // Diese Funktion wird jetzt NUR aufgerufen, wenn sie gebraucht wird.
  if (!admin.apps.length) {
    try {
      const serviceAccountString = Buffer.from(
        process.env.GCP_SA_B64 as string,
        'base64'
      ).toString('utf-8');

      const serviceAccount = JSON.parse(serviceAccountString);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('Firebase admin initialization error', error);
      throw error;
    }
  }
};

// DAS IST DER NEUE, SICHERE BAUPLAN
// Jede Funktion stellt sicher, dass das Haus gebaut ist, BEVOR sie das Werkzeug holt.
export const getAdminDb = () => {
  initializeFirebaseAdmin();
  return admin.firestore();
};

export const getAdminAuth = () => {
  initializeFirebaseAdmin();
  return admin.auth();
};