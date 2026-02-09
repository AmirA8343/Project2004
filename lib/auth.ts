import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseAuth } from "./firebaseAdmin";

export type AuthContext = {
  uid: string;
};

function getBearerToken(req: VercelRequest): string | null {
  const value = req.headers.authorization;
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthContext | null> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
}
