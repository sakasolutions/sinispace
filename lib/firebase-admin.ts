import admin from 'firebase-admin';

// Diese Funktion initialisiert Firebase nur EINMAL und stellt sicher,
// dass wir nicht versuchen, es erneut zu initialisieren.
const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) {
    return;
  }

  const serviceAccountKey = process.env.GCP_SA_B64;
  if (!serviceAccountKey) {
    // Wenn wir diesen Fehler sehen, WISSEN wir, dass Vercel die Variable nicht lädt.
    throw new Error('GCP_SA_B64 environment variable is not set.');
  }

  try {
    const serviceAccountString = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(serviceAccountString);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error: any) {
    // Wir geben eine detailliertere Fehlermeldung aus
    console.error('FATAL: Firebase admin initialization failed:', error.message);
    throw new Error(`Firebase admin initialization failed: ${error.message}`);
  }
};

// Jede Funktion stellt sicher, dass die App initialisiert ist, bevor sie aufgerufen wird.
export const getAdminDb = () => {
  initializeFirebaseAdmin();
  return admin.firestore();
};

export const getAdminAuth = () => {
  initializeFirebaseAdmin();
  return admin.auth();
};