import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseAuth } from "./firebaseAdmin";

export type AuthContext = {
  uid: string;
};

const EXPECTED_FIREBASE_PROJECT_ID = "fitmacros-personal";

type TokenSource = "authorization" | "x-firebase-token";

type TokenLookupResult = {
  token: string | null;
  source: TokenSource | "none";
};

function getBearerToken(req: VercelRequest): string | null {
  const value = req.headers.authorization;
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function getFirebaseTokenHeader(req: VercelRequest): string | null {
  const value = req.headers["x-firebase-token"];
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (Array.isArray(value) && value[0] && value[0].trim().length > 0) {
    return value[0].trim();
  }
  return null;
}

function getToken(req: VercelRequest): TokenLookupResult {
  const bearerToken = getBearerToken(req);
  if (bearerToken) {
    return { token: bearerToken, source: "authorization" };
  }

  const firebaseTokenHeader = getFirebaseTokenHeader(req);
  if (firebaseTokenHeader) {
    return { token: firebaseTokenHeader, source: "x-firebase-token" };
  }

  return { token: null, source: "none" };
}

export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthContext | null> {
  const { token, source } = getToken(req);
  if (!token) {
    console.error("Auth failed: missing token", {
      hasAuthorizationHeader: Boolean(req.headers.authorization),
      hasFirebaseTokenHeader: Boolean(req.headers["x-firebase-token"]),
    });
    res.status(401).json({
      error: "missing_token",
      message:
        "Missing Firebase ID token. Send Authorization: Bearer <token> or x-firebase-token header.",
    });
    return null;
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    const expectedIss = `https://securetoken.google.com/${EXPECTED_FIREBASE_PROJECT_ID}`;

    console.log("Auth token decoded", {
      source,
      uid: decoded.uid,
      aud: decoded.aud,
      iss: decoded.iss,
      expectedProjectId: EXPECTED_FIREBASE_PROJECT_ID,
    });

    if (decoded.aud !== EXPECTED_FIREBASE_PROJECT_ID || decoded.iss !== expectedIss) {
      console.error("Auth failed: token project mismatch", {
        source,
        uid: decoded.uid,
        aud: decoded.aud,
        iss: decoded.iss,
        expectedAud: EXPECTED_FIREBASE_PROJECT_ID,
        expectedIss,
      });
      res.status(401).json({
        error: "invalid_token",
        message: `Token project mismatch. Expected aud=${EXPECTED_FIREBASE_PROJECT_ID}.`,
      });
      return null;
    }

    return { uid: decoded.uid };
  } catch (error: any) {
    console.error("Auth failed: verifyIdToken failed", {
      source,
      code: error?.code ?? null,
      message: error?.message ?? "Token verification failed",
    });
    res.status(401).json({
      error: "invalid_token",
      message: error?.message ?? "Token verification failed",
    });
    return null;
  }
}
