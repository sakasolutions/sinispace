import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccountString = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string,
      'base64'
    ).toString('utf-8');

    const serviceAccount = JSON.parse(serviceAccountString);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth };