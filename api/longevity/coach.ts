import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../../lib/auth";
import { getFirebaseFirestore } from "../../lib/firebaseAdmin";
import {
  buildCoachReply,
  getDateKey,
  isNonEmptyString,
  isObjectArray,
  isPlainObject,
  JsonObject,
} from "../../lib/longevity";

type CoachRequest = {
  question: string;
  today: JsonObject;
  history: JsonObject[];
  messages: JsonObject[];
};

type CoachResponse = {
  reply: string;
};

function parseCoachRequest(body: unknown): CoachRequest | null {
  if (!isPlainObject(body)) return null;
  const { question, today, history, messages } = body;

  if (!isNonEmptyString(question)) return null;
  if (!isPlainObject(today)) return null;
  if (!isObjectArray(history)) return null;
  if (!isObjectArray(messages)) return null;

  return { question, today, history, messages };
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const parsed = parseCoachRequest(req.body);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const dateKey = getDateKey(parsed.today);
    const healthRecord = await loadHealthRecord(auth.uid, dateKey);
    const reply = buildCoachReply({
      question: parsed.question,
      today: parsed.today,
      history: parsed.history,
      messages: parsed.messages,
      healthRecord,
    });

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("POST /api/longevity/coach failed", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
