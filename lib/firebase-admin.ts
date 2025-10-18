// lib/firebase-admin.ts
import admin from 'firebase-admin';

let initialized = false;

function initializeFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) return;

  const b64 = process.env.GCP_SA_B64;
  if (!b64) {
    throw new Error('GCP_SA_B64 is not set (base64-encoded service account JSON).');
  }

  // Base64 -> JSON
  const json = Buffer.from(b64, 'base64').toString('utf-8');

  let credentialObj: admin.ServiceAccount;
  try {
    credentialObj = JSON.parse(json);
  } catch (e) {
    // Häufige Ursache: falsches/abgeschnittenes Env
    throw new Error('GCP_SA_B64 is not valid JSON. Check your env variable.');
  }

  // Wichtig: kein Edge Runtime – dafür sorgst du in den Routen mit export const runtime = 'nodejs'
  admin.initializeApp({
    credential: admin.credential.cert(credentialObj),
  });

  initialized = true;
}

export function getAdminAuth() {
  initializeFirebaseAdmin();
  return admin.auth();
}

export function getAdminDb() {
  initializeFirebaseAdmin();
  return admin.firestore();
}
