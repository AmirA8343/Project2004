import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { getFirebaseFirestore } from "../../lib/firebaseAdmin";
import {
  buildFaceAnalysis,
  FaceAnalyzeResponse,
  getDateKey,
  isNonEmptyString,
  isObjectArray,
  isPlainObject,
  JsonObject,
} from "../../lib/longevity";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

type FaceAnalyzeRequest = {
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

function parseFaceAnalyzeRequest(body: unknown): FaceAnalyzeRequest | null {
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

async function persistFaceAnalysis(
  uid: string,
  dateKey: string,
  input: FaceAnalyzeRequest,
  result: FaceAnalyzeResponse,
  source: "vision_ai" | "placeholder"
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
        faceAnalyze: {
          imageUrl: input.imageUrl,
          today: input.today,
          history: input.history,
          source,
          result,
        },
      },
      { merge: true }
    );
}

async function runVisionFaceAnalysis(input: {
  imageUrl: string;
  today: JsonObject;
  history: JsonObject[];
  healthRecord: JsonObject | null;
}): Promise<FaceAnalyzeResponse | null> {
  if (!OPENAI_API_KEY) return null;

  const prompt = `You are an aesthetics and wellness analysis assistant. Analyze ONLY the provided face image.

Return STRICT JSON only using this schema:
{
  "jawlineIndex": number,            // 0..100
  "skinClarityIndex": number,        // 0..100
  "faceFatEstimate": "low"|"medium"|"high",
  "overallScore": number,            // 0..100
  "measurements": {
    "potential": number,
    "jawline": number,
    "eyeArea": number,
    "cheekbones": number,
    "symmetry": number,
    "facialThirds": number,
    "skinQuality": number
  },
  "suggestions": {
    "skin": string[],
    "jawline": string[],
    "training": string[],
    "routine": string[]
  },
  "notes": string[]
}

Rules:
- Return only valid JSON (no markdown).
- Keep values realistic and consistent.
- suggestions arrays must have exactly 3 concise items each.
- notes must have 2-4 concise items.
- This is non-medical wellness feedback.`;

  const computed = isPlainObject(input.today.computed)
    ? input.today.computed
    : isPlainObject(input.healthRecord?.computed)
      ? input.healthRecord?.computed
      : {};

  const contextText = JSON.stringify({
    todayComputed: computed,
    historyDays: input.history.length,
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
            { type: "text", text: "Analyze this face image and return JSON only." },
            { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.warn("Vision face analyze failed", { status: resp.status, body: body.slice(0, 240) });
    return null;
  }

  const data = (await resp.json()) as any;
  const content = data?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== "object") return null;

  const jawlineIndex = clamp(Math.round(Number(parsed.jawlineIndex) || 0), 0, 100);
  const skinClarityIndex = clamp(Math.round(Number(parsed.skinClarityIndex) || 0), 0, 100);
  const faceFatEstimate =
    parsed.faceFatEstimate === "low" || parsed.faceFatEstimate === "medium" || parsed.faceFatEstimate === "high"
      ? parsed.faceFatEstimate
      : jawlineIndex >= 72
        ? "low"
        : jawlineIndex >= 52
          ? "medium"
          : "high";

  const m = isPlainObject(parsed.measurements) ? parsed.measurements : {};
  const potential = clamp(Math.round(Number(m.potential) || ((jawlineIndex + skinClarityIndex) / 2)), 0, 100);
  const eyeArea = clamp(Math.round(Number(m.eyeArea) || ((skinClarityIndex + potential) / 2)), 0, 100);
  const cheekbones = clamp(Math.round(Number(m.cheekbones) || ((jawlineIndex + potential) / 2)), 0, 100);
  const symmetry = clamp(Math.round(Number(m.symmetry) || ((eyeArea + cheekbones) / 2)), 0, 100);
  const facialThirds = clamp(Math.round(Number(m.facialThirds) || ((symmetry + potential) / 2)), 0, 100);
  const skinQuality = clamp(Math.round(Number(m.skinQuality) || skinClarityIndex), 0, 100);

  const overallScore = clamp(
    Math.round(
      Number(parsed.overallScore) ||
        (potential * 0.2 +
          jawlineIndex * 0.18 +
          eyeArea * 0.12 +
          cheekbones * 0.12 +
          symmetry * 0.13 +
          facialThirds * 0.1 +
          skinQuality * 0.15)
    ),
    0,
    100
  );

  const s = isPlainObject(parsed.suggestions) ? parsed.suggestions : {};
  const skin = toStringArray(s.skin).slice(0, 3);
  const jawline = toStringArray(s.jawline).slice(0, 3);
  const training = toStringArray(s.training).slice(0, 3);
  const routine = toStringArray(s.routine).slice(0, 3);

  const notes = toStringArray(parsed.notes).slice(0, 4);

  return {
    jawlineIndex,
    skinClarityIndex,
    faceFatEstimate,
    overallScore,
    measurements: {
      potential,
      jawline: jawlineIndex,
      eyeArea,
      cheekbones,
      symmetry,
      facialThirds,
      skinQuality,
    },
    suggestions: {
      skin: skin.length ? skin : ["Keep daily sunscreen use.", "Improve sleep consistency.", "Hydrate earlier in day."],
      jawline: jawline.length
        ? jawline
        : ["Maintain sodium consistency.", "Improve neck/posture alignment.", "Aim gradual body fat reduction."],
      training: training.length
        ? training
        : ["Strength train 3-4 times weekly.", "Add 2 zone-2 cardio sessions.", "Increase daily step count."],
      routine: routine.length
        ? routine
        : ["AM sunlight + hydration.", "Protein-focused meals.", "Evening wind-down and fixed bedtime."],
    },
    notes: notes.length ? notes : ["AI vision analysis complete."],
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

  const parsed = parseFaceAnalyzeRequest(req.body);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const dateKey = getDateKey(parsed.today);
    const healthRecord = await loadHealthRecord(auth.uid, dateKey);

    const vision = await runVisionFaceAnalysis({
      imageUrl: parsed.imageUrl,
      today: parsed.today,
      history: parsed.history,
      healthRecord,
    });

    const result =
      vision ??
      buildFaceAnalysis({
        uid: auth.uid,
        imageUrl: parsed.imageUrl,
        today: parsed.today,
        history: parsed.history,
        healthRecord,
      });

    await persistFaceAnalysis(auth.uid, dateKey, parsed, result, vision ? "vision_ai" : "placeholder");
    return res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/longevity/face-analyze failed", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
