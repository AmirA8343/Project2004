import admin from "firebase-admin";

type ServiceAccountShape = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

let app: admin.app.App | null = null;
const EXPECTED_FIREBASE_PROJECT_ID = "fitmacros-personal";

function parseServiceAccount(): ServiceAccountShape | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKeyRaw) {
    if (projectId !== EXPECTED_FIREBASE_PROJECT_ID) {
      console.error("Firebase config warning: unexpected FIREBASE_PROJECT_ID", {
        configuredProjectId: projectId,
        expectedProjectId: EXPECTED_FIREBASE_PROJECT_ID,
      });
    }
    return {
      projectId,
      clientEmail,
      privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
    };
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountShape>;
    if (!parsed.projectId || !parsed.clientEmail || !parsed.privateKey) {
      return null;
    }

    if (parsed.projectId !== EXPECTED_FIREBASE_PROJECT_ID) {
      console.error("Firebase config warning: unexpected service account project", {
        configuredProjectId: parsed.projectId,
        expectedProjectId: EXPECTED_FIREBASE_PROJECT_ID,
      });
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
