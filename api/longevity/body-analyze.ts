import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { getFirebaseFirestore } from "../../lib/firebaseAdmin";
import {
  BodyAnalyzeResponse,
  buildBodyAnalysis,
  buildBodyExercisePlan,
  getDateKey,
  isNonEmptyString,
  isObjectArray,
  isPlainObject,
  JsonObject,
} from "../../lib/longevity";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

type BodyAnalyzeRequest = {
  imageUrl: string;
  today: JsonObject;
  history: JsonObject[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractJson(text: string): any | null {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      // continue
    }
  }
  const raw = text.match(/\{[\s\S]*\}/);
  if (raw?.[0]) {
    try {
      return JSON.parse(raw[0]);
    } catch {
      // continue
    }
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseBodyAnalyzeRequest(body: unknown): BodyAnalyzeRequest | null {
  if (!isPlainObject(body)) return null;
  const { imageUrl, today, history } = body;

  if (!isNonEmptyString(imageUrl)) return null;
  if (!isPlainObject(today)) return null;
  if (!isObjectArray(history)) return null;

  return { imageUrl, today, history };
}

async function loadHealthRecord(uid: string, dateKey: string): Promise<JsonObject | null> {
  try {
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
  } catch (error) {
    console.warn("loadHealthRecord failed; continuing without health record", {
      message: (error as any)?.message ?? String(error),
      code: (error as any)?.code ?? null,
    });
    return null;
  }
}

async function persistBodyAnalysis(
  uid: string,
  dateKey: string,
  input: BodyAnalyzeRequest,
  result: BodyAnalyzeResponse,
  source: "vision_ai" | "placeholder"
): Promise<void> {
  try {
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
            source,
            result,
          },
        },
        { merge: true }
      );
  } catch (error) {
    console.warn("persistBodyAnalysis failed; result not saved to Firestore", {
      message: (error as any)?.message ?? String(error),
      code: (error as any)?.code ?? null,
    });
  }
}

async function runVisionBodyAnalysis(input: {
  imageUrl: string;
  today: JsonObject;
  history: JsonObject[];
  healthRecord: JsonObject | null;
}): Promise<BodyAnalyzeResponse | null> {
  if (!OPENAI_API_KEY) return null;

  const prompt = `You are an elite fitness coach and physique analysis assistant. Analyze ONLY the provided body photo.

Return STRICT JSON only:
{
  "bodyFatRangeEstimate": "string",
  "postureScore": number,            // 0..100
  "muscleDefinitionScore": number,   // 0..100
  "exercisePlan": {
    "oneWeek": string[],
    "oneMonth": string[]
  },
  "notes": string[]                  // 2-4 concise items
}

Rules:
- Return only valid JSON (no markdown).
- Provide realistic non-medical wellness estimates.
- postureScore and muscleDefinitionScore must be 0..100.
- exercisePlan.oneWeek must have exactly 7 day lines starting with Mon..Sun.
- Every day line must contain 4+ exercises and include REP/TIME prescriptions.
- Program must reflect body type: fat-loss, recomposition, or athletic performance emphasis.
- Include posture correction if postureScore < 62 and conditioning bias if body-fat estimate is high.
- exercisePlan.oneMonth must have exactly 4 concise progression lines.`;

  const computed = isPlainObject(input.today.computed)
    ? input.today.computed
    : isPlainObject(input.healthRecord?.computed)
      ? input.healthRecord?.computed
      : {};

  const contextText = JSON.stringify({
    todayComputed: computed,
    historyDays: input.history.length,
    hasTodayComputed: Boolean(isPlainObject(input.today.computed)),
  });

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: `Context: ${contextText}` },
            { type: "text", text: "Analyze this body image and return JSON only." },
            { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.warn("Vision body analyze failed", { status: resp.status, body: body.slice(0, 240) });
    return null;
  }

  const data = (await resp.json()) as any;
  const content = data?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== "object") return null;

  const bodyFatRangeEstimate =
    typeof parsed.bodyFatRangeEstimate === "string" && parsed.bodyFatRangeEstimate.trim().length > 0
      ? parsed.bodyFatRangeEstimate.trim()
      : "18-24%";

  const postureScore = clamp(Math.round(Number(parsed.postureScore) || 0), 0, 100);
  const muscleDefinitionScore = clamp(Math.round(Number(parsed.muscleDefinitionScore) || 0), 0, 100);
  const notes = toStringArray(parsed.notes).slice(0, 4);

  const fallbackPlan = buildBodyExercisePlan({
    postureScore,
    muscleDefinitionScore,
    bodyFatRangeEstimate,
    healthScore: clamp(Math.round(Number((computed as any)?.healthScore) || 70), 0, 100),
  });

  const e = isPlainObject((parsed as any).exercisePlan) ? (parsed as any).exercisePlan : {};
  const oneWeek = toStringArray((e as any).oneWeek).slice(0, 7);
  const oneMonth = toStringArray((e as any).oneMonth).slice(0, 4);

  return {
    bodyFatRangeEstimate,
    postureScore,
    muscleDefinitionScore,
    exercisePlan: {
      oneWeek: oneWeek.length === 7 ? oneWeek : fallbackPlan.oneWeek,
      oneMonth: oneMonth.length === 4 ? oneMonth : fallbackPlan.oneMonth,
    },
    notes: notes.length
      ? notes
      : [
          "AI vision analysis complete.",
          "Posture and muscle definition are estimates from visible cues.",
        ],
  };
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

    const vision = await runVisionBodyAnalysis({
      imageUrl: parsed.imageUrl,
      today: parsed.today,
      history: parsed.history,
      healthRecord,
    });

    const result =
      vision ??
      buildBodyAnalysis({
        uid: auth.uid,
        imageUrl: parsed.imageUrl,
        today: parsed.today,
        history: parsed.history,
        healthRecord,
      });

    await persistBodyAnalysis(auth.uid, dateKey, parsed, result, vision ? "vision_ai" : "placeholder");
    return res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/longevity/body-analyze failed", error);
    try {
      const dateKey = getDateKey(parsed.today);
      const healthRecord = await loadHealthRecord(auth.uid, dateKey);
      const fallback = buildBodyAnalysis({
        uid: auth.uid,
        imageUrl: parsed.imageUrl,
        today: parsed.today,
        history: parsed.history,
        healthRecord,
      });
      await persistBodyAnalysis(auth.uid, dateKey, parsed, fallback, "placeholder");
      return res.status(200).json(fallback);
    } catch (fallbackError) {
      console.error("POST /api/longevity/body-analyze fallback failed", fallbackError);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
