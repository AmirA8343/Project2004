import admin from "firebase-admin";

type ServiceAccountShape = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

let app: admin.app.App | null = null;

function parseServiceAccount(): ServiceAccountShape | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountShape>;
    if (!parsed.projectId || !parsed.clientEmail || !parsed.privateKey) {
      return null;
    }

    return {
      projectId: parsed.projectId,
      clientEmail: parsed.clientEmail,
      privateKey: parsed.privateKey.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

function getOrInitApp(): admin.app.App {
  if (app) return app;
  if (admin.apps.length > 0) {
    app = admin.apps[0]!;
    return app;
  }

  const serviceAccount = parseServiceAccount();
  app = serviceAccount
    ? admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    : admin.initializeApp();
  return app;
}

export function getFirebaseAuth(): admin.auth.Auth {
  return getOrInitApp().auth();
}

export function getFirebaseFirestore(): admin.firestore.Firestore {
  return getOrInitApp().firestore();
}
