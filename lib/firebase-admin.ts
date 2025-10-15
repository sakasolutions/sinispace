import admin from 'firebase-admin';

const initializeFirebaseAdmin = () => {
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

export const getAdminDb = () => {
  initializeFirebaseAdmin();
  return admin.firestore();
};

export const getAdminAuth = () => {
  initializeFirebaseAdmin();
  return admin.auth();
};