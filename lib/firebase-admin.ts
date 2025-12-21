// lib/firebase-admin.ts
import admin from 'firebase-admin';

let initialized = false;

function initializeFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) {
    console.log('✅ [Firebase Admin] Bereits initialisiert');
    return;
  }

  const b64 = process.env.GCP_SA_B64;
  if (!b64) {
    const error = 'GCP_SA_B64 is not set (base64-encoded service account JSON).';
    console.error('❌ [Firebase Admin]', error);
    throw new Error(error);
  }

  console.log('🔍 [Firebase Admin] Dekodiere Service Account...');
  
  // Base64 -> JSON
  let json: string;
  try {
    json = Buffer.from(b64, 'base64').toString('utf-8');
  } catch (e: any) {
    const error = `GCP_SA_B64 Base64-Dekodierung fehlgeschlagen: ${e.message}`;
    console.error('❌ [Firebase Admin]', error);
    throw new Error(error);
  }

  // Parse JSON - verwende 'any' für die Validierung, da das Raw-JSON snake_case verwendet
  let rawCredential: any;
  try {
    rawCredential = JSON.parse(json);
    console.log('✅ [Firebase Admin] Service Account JSON geparst');
  } catch (e: any) {
    // Häufige Ursache: falsches/abgeschnittenes Env
    const error = `GCP_SA_B64 is not valid JSON: ${e.message}. Check your env variable.`;
    console.error('❌ [Firebase Admin]', error);
    throw new Error(error);
  }

  // Prüfe ob wichtige Felder vorhanden sind (Raw-JSON verwendet snake_case)
  if (!rawCredential.project_id || !rawCredential.private_key || !rawCredential.client_email) {
    const error = 'GCP_SA_B64 JSON fehlt wichtige Felder (project_id, private_key, client_email)';
    console.error('❌ [Firebase Admin]', error);
    throw new Error(error);
  }

  console.log('🔍 [Firebase Admin] Initialisiere Firebase App...');
  
  // Wichtig: kein Edge Runtime – dafür sorgst du in den Routen mit export const runtime = 'nodejs'
  // admin.credential.cert() konvertiert automatisch snake_case zu camelCase
  try {
    const credentialObj: admin.ServiceAccount = rawCredential as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(credentialObj),
    });
    console.log('✅ [Firebase Admin] Erfolgreich initialisiert für Projekt:', rawCredential.project_id);
    initialized = true;
  } catch (e: any) {
    const error = `Firebase Admin Initialisierung fehlgeschlagen: ${e.message}`;
    console.error('❌ [Firebase Admin]', error);
    throw new Error(error);
  }
}

export function getAdminAuth() {
  initializeFirebaseAdmin();
  return admin.auth();
}

export function getAdminDb() {
  initializeFirebaseAdmin();
  return admin.firestore();
}
