import admin from 'firebase-admin';

function initializeFirebaseAdmin() {
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
}

initializeFirebaseAdmin();

// HIER IST MEIN FEHLER BEHOBEN. ICH HABE "EXPORT" HINZUGEFÜGT.
export const getAdminDb = () => admin.firestore();
export const getAdminAuth = () => admin.auth();