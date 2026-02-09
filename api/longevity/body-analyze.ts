import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { getFirebaseFirestore } from "../../lib/firebaseAdmin";
import {
  BodyAnalyzeResponse,
  buildBodyAnalysis,
  getDateKey,
  isNonEmptyString,
  isObjectArray,
  isPlainObject,
  JsonObject,
} from "../../lib/longevity";

type BodyAnalyzeRequest = {
  imageUrl: string;
  today: JsonObject;
  history: JsonObject[];
};

function parseBodyAnalyzeRequest(body: unknown): BodyAnalyzeRequest | null {
  if (!isPlainObject(body)) return null;
  const { imageUrl, today, history } = body;

  if (!isNonEmptyString(imageUrl)) return null;
  if (!isPlainObject(today)) return null;
  if (!isObjectArray(history)) return null;

  return { imageUrl, today, history };
}

async function loadHealthRecord(uid: string, dateKey: string): Promise<JsonObject | null> {
  const firestore = getFirebaseFirestore();
  const snap = await firestore
    .collection("users")
    .doc(uid)
    .collection("healthRecords")
    .doc(dateKey)
    .get();

  if (!snap.exists) return null;
  const data = snap.data();
  return data && isPlainObject(data) ? (data as JsonObject) : null;
}

async function persistBodyAnalysis(
  uid: string,
  dateKey: string,
  input: BodyAnalyzeRequest,
  result: BodyAnalyzeResponse
): Promise<void> {
  const firestore = getFirebaseFirestore();
  await firestore
    .collection("users")
    .doc(uid)
    .collection("aiAnalysis")
    .doc(dateKey)
    .set(
      {
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
        bodyAnalyze: {
          imageUrl: input.imageUrl,
          today: input.today,
          history: input.history,
          result,
        },
      },
      { merge: true }
    );
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const parsed = parseBodyAnalyzeRequest(req.body);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const dateKey = getDateKey(parsed.today);
    const healthRecord = await loadHealthRecord(auth.uid, dateKey);

    const result = buildBodyAnalysis({
      uid: auth.uid,
      imageUrl: parsed.imageUrl,
      today: parsed.today,
      history: parsed.history,
      healthRecord,
    });

    await persistBodyAnalysis(auth.uid, dateKey, parsed, result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/longevity/body-analyze failed", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
