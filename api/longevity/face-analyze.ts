import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { getFirebaseFirestore } from "../../lib/firebaseAdmin";
import {
  AVAILABLE_FACE_EXERCISE_IDS,
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
  availableExerciseIds: string[];
  availableFaceVideoExercises: Array<{
    exerciseId: string;
    videoKey: string;
    fileName: string;
  }>;
  faceExerciseVideoMap: Record<
    string,
    {
      videoKey: string | null;
      fileName: string | null;
    }
  >;
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

function extractExerciseIdsFromPlanLine(line: string): string[] {
  const ids: string[] = [];
  const regex = /\[ID:([a-z0-9_]+)\]/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(line))) {
    if (match[1]) ids.push(match[1].toLowerCase());
  }
  return ids;
}

function isPlanVideoCatalogSafe(
  oneWeek: string[],
  allowedExerciseIds: string[]
): { valid: boolean; reason: string } {
  if (oneWeek.length !== 7) return { valid: false, reason: "week_length_invalid" };
  const allowed = new Set(allowedExerciseIds);

  for (const line of oneWeek) {
    const ids = extractExerciseIdsFromPlanLine(line);
    if (ids.length < 4) return { valid: false, reason: "missing_or_short_id_tags" };
    if (ids.some((id) => !allowed.has(id))) return { valid: false, reason: "contains_unsupported_exercise_id" };
  }
  return { valid: true, reason: "ok" };
}

function buildCatalogSafeFallbackExercisePlan(): { oneWeek: string[]; oneMonth: string[] } {
  return {
    oneWeek: [
      "Mon: 1) Mewing Hold [TIME 90s x 4] 2) Chin Tucks [REPS 20 x 3] 3) Neck Curls [REPS 15 x 3] 4) Nasal Breathing [TIME 300s x 2].",
      "Tue: 1) Jaw Mobility Drill [TIME 120s x 2] 2) Tongue Clicks [REPS 30 x 3] 3) Neck Extensions [REPS 15 x 3] 4) Zone-2 Nasal Cardio [TIME 600s x 2].",
      "Wed: 1) Mewing Pulses [TIME 60s x 5] 2) Wall Posture Holds [TIME 45s x 4] 3) Neck Isometric Press [TIME 30s x 4] 4) Jaw Control [REPS 16 x 3].",
      "Thu: 1) Chewing Protocol [TIME 300s x 2] 2) Jaw Retractions [REPS 15 x 3] 3) Chin Tuck Holds [TIME 30s x 4] 4) Recovery Walk [TIME 900s x 2].",
      "Fri: 1) Mewing Endurance [TIME 120s x 4] 2) Neck Flex/Ext [REPS 12 x 4] 3) Jaw Open-Close [REPS 20 x 3] 4) Nasal Breathing [TIME 240s x 3].",
      "Sat: 1) Lymph Drain Sequence [TIME 300s x 2] 2) Nasal Walk [TIME 900s x 2] 3) Tongue Resets [REPS 40 x 2] 4) Jaw Isometrics [TIME 30s x 5].",
      "Sun: 1) Face+Neck Mobility [TIME 300s x 2] 2) Posture Tune-up [TIME 60s x 4] 3) Gentle Walk [TIME 1200s x 1] 4) Mewing Hold [TIME 60s x 3].",
    ],
    oneMonth: [
      "Week 1: Build mewing/posture consistency daily.",
      "Week 2: Increase neck/jaw accessory volume gradually.",
      "Week 3: Tighten sleep/sodium consistency for facial definition.",
      "Week 4: Deload + evaluate jawline/symmetry trend.",
    ],
  };
}

function normalizeAvailableExerciseIds(value: unknown): string[] {
  const allowed = new Set<string>(AVAILABLE_FACE_EXERCISE_IDS);
  const incoming = toStringArray(value).map((item) => item.trim());
  const filtered = incoming.filter((item) => allowed.has(item));
  return filtered.length ? filtered : [...AVAILABLE_FACE_EXERCISE_IDS];
}

function parseAvailableFaceVideoExercises(
  value: unknown,
  availableExerciseIds: string[]
): Array<{ exerciseId: string; videoKey: string; fileName: string }> {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(availableExerciseIds);
  const out: Array<{ exerciseId: string; videoKey: string; fileName: string }> = [];

  for (const entry of value) {
    if (!isPlainObject(entry)) continue;
    const exerciseId = isNonEmptyString(entry.exerciseId) ? entry.exerciseId.trim() : "";
    const videoKey = isNonEmptyString(entry.videoKey) ? entry.videoKey.trim() : "";
    const fileName = isNonEmptyString(entry.fileName) ? entry.fileName.trim() : "";
    if (!exerciseId || !videoKey || !fileName) continue;
    if (!allowed.has(exerciseId)) continue;
    out.push({ exerciseId, videoKey, fileName });
  }

  return out;
}

function buildFallbackVideoExercisesFromMap(
  faceExerciseVideoMap: Record<string, { videoKey: string | null; fileName: string | null }>,
  availableExerciseIds: string[]
): Array<{ exerciseId: string; videoKey: string; fileName: string }> {
  const allowed = new Set<string>(availableExerciseIds);
  const out: Array<{ exerciseId: string; videoKey: string; fileName: string }> = [];
  for (const [exerciseId, value] of Object.entries(faceExerciseVideoMap)) {
    if (!allowed.has(exerciseId)) continue;
    if (!value?.videoKey || !value?.fileName) continue;
    out.push({
      exerciseId,
      videoKey: value.videoKey,
      fileName: value.fileName,
    });
  }
  return out;
}

function parseFaceExerciseVideoMap(
  value: unknown,
  availableExerciseIds: string[]
): Record<string, { videoKey: string | null; fileName: string | null }> {
  if (!isPlainObject(value)) return {};

  const allowed = new Set<string>(availableExerciseIds);
  const out: Record<string, { videoKey: string | null; fileName: string | null }> = {};

  for (const [exerciseId, rawEntry] of Object.entries(value)) {
    if (!allowed.has(exerciseId)) continue;
    if (!isPlainObject(rawEntry)) continue;
    const videoKey = isNonEmptyString(rawEntry.videoKey) ? rawEntry.videoKey.trim() : null;
    const fileName = isNonEmptyString(rawEntry.fileName) ? rawEntry.fileName.trim() : null;
    out[exerciseId] = { videoKey, fileName };
  }

  return out;
}

function parseFaceAnalyzeRequest(body: unknown): FaceAnalyzeRequest | null {
  if (!isPlainObject(body)) return null;
  const {
    imageUrl,
    today,
    history,
    availableExerciseIds,
    availableFaceVideoExercises,
    faceExerciseVideoMap,
  } = body;

  if (!isNonEmptyString(imageUrl)) return null;
  if (!isPlainObject(today)) return null;
  if (!isObjectArray(history)) return null;

  const normalizedExerciseIds = normalizeAvailableExerciseIds(availableExerciseIds);
  const normalizedVideoExercises = parseAvailableFaceVideoExercises(
    availableFaceVideoExercises,
    normalizedExerciseIds
  );
  const normalizedVideoMap = parseFaceExerciseVideoMap(faceExerciseVideoMap, normalizedExerciseIds);
  const videoExerciseCatalog = normalizedVideoExercises.length
    ? normalizedVideoExercises
    : buildFallbackVideoExercisesFromMap(normalizedVideoMap, normalizedExerciseIds);

  return {
    imageUrl,
    today,
    history,
    availableExerciseIds: normalizedExerciseIds,
    availableFaceVideoExercises: videoExerciseCatalog,
    faceExerciseVideoMap: normalizedVideoMap,
  };
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

async function persistFaceAnalysis(
  uid: string,
  dateKey: string,
  input: FaceAnalyzeRequest,
  result: FaceAnalyzeResponse,
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
  } catch (error) {
    console.warn("persistFaceAnalysis failed; result not saved to Firestore", {
      message: (error as any)?.message ?? String(error),
      code: (error as any)?.code ?? null,
    });
  }
}

async function runVisionFaceAnalysis(input: {
  imageUrl: string;
  today: JsonObject;
  history: JsonObject[];
  healthRecord: JsonObject | null;
  availableExerciseIds: string[];
  availableFaceVideoExercises: Array<{ exerciseId: string; videoKey: string; fileName: string }>;
  faceExerciseVideoMap: Record<string, { videoKey: string | null; fileName: string | null }>;
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
  "exercisePlan": {
    "oneWeek": string[],
    "oneMonth": string[]
  },
  "notes": string[]
}

Rules:
- Return only valid JSON (no markdown).
- Keep values realistic and consistent.
- suggestions arrays must have exactly 3 concise items each.
- exercisePlan.oneWeek must have exactly 7 day lines starting with Mon..Sun.
- Each day line must include 4 exercises minimum.
- Every exercise must include its ID tag, e.g. [ID:mewing_hold].
- Mix REP-based and TIME-based prescriptions in every day.
- Use clear set notation like [REPS 20 x 3] or [TIME 90s x 4].
- Include jawline/tongue posture, neck-jaw drills, posture work, and conditioning.
- exercisePlan.oneMonth must have 4 concise lines (week-by-week progression) with face-focused training progression.
- notes must have 2-4 concise items.
- This is non-medical wellness feedback.
- Use ONLY this video-backed face exercise catalog (exerciseId -> fileName):
${input.availableFaceVideoExercises.map((item) => `- ${item.exerciseId} -> ${item.fileName}`).join("\n")}
- If unsure, pick the closest exerciseId from the catalog above.`;

  const computed = isPlainObject(input.today.computed)
    ? input.today.computed
    : isPlainObject(input.healthRecord?.computed)
      ? input.healthRecord?.computed
      : {};

  const contextText = JSON.stringify({
    todayComputed: computed,
    historyDays: input.history.length,
    availableFaceExercises: input.availableExerciseIds,
    availableFaceVideoExercises: input.availableFaceVideoExercises,
    faceExerciseVideoMap: input.faceExerciseVideoMap,
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


  const e = isPlainObject(parsed.exercisePlan) ? parsed.exercisePlan : {};
  const oneWeek = toStringArray(e.oneWeek).slice(0, 7);
  const oneMonth = toStringArray(e.oneMonth).slice(0, 4);
  const fallbackExercisePlan = buildCatalogSafeFallbackExercisePlan();
  const planSafety = isPlanVideoCatalogSafe(oneWeek, input.availableExerciseIds);
  const usedBackendPlan = oneWeek.length === 7 && oneMonth.length === 4 && planSafety.valid;
  if (!planSafety.valid) {
    console.log("[face-analyze] backend plan rejected, using catalog-safe fallback", {
      reason: planSafety.reason,
    });
  }
  const selectedExercisePlan = usedBackendPlan
    ? { oneWeek, oneMonth }
    : fallbackExercisePlan;

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
    exercisePlan: selectedExercisePlan,
    notes: [
      ...(notes.length ? notes : ["AI vision analysis complete."]),
      `Face workout constrained to supported video-backed exercise catalog (${input.availableExerciseIds.length} items).`,
      ...(usedBackendPlan
        ? ["LLM face plan accepted: all exercise IDs matched video-backed catalog."]
        : ["LLM face plan auto-replaced with catalog-safe fallback due to unsupported/missing exercise IDs."]),
    ].slice(0, 4),
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
    console.log("[face-analyze] request metadata", {
      availableExerciseCount: parsed.availableExerciseIds.length,
      availableFaceVideoExerciseCount: parsed.availableFaceVideoExercises.length,
      mappedVideoCount: Object.keys(parsed.faceExerciseVideoMap).length,
    });
    if (parsed.availableFaceVideoExercises.length > 0) {
      console.log("[face-analyze] available face video exercises", parsed.availableFaceVideoExercises);
    }
    if (Object.keys(parsed.faceExerciseVideoMap).length > 0) {
      console.log("[face-analyze] received exercise->video map", parsed.faceExerciseVideoMap);
    }

    const dateKey = getDateKey(parsed.today);
    const healthRecord = await loadHealthRecord(auth.uid, dateKey);

    const vision = await runVisionFaceAnalysis({
      imageUrl: parsed.imageUrl,
      today: parsed.today,
      history: parsed.history,
      healthRecord,
      availableExerciseIds: parsed.availableExerciseIds,
      availableFaceVideoExercises: parsed.availableFaceVideoExercises,
      faceExerciseVideoMap: parsed.faceExerciseVideoMap,
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

    const resultWithVideoMap: FaceAnalyzeResponse = {
      ...result,
      faceExerciseVideoMap: parsed.faceExerciseVideoMap,
    };

    console.log("[face-analyze] response exercise->video map", resultWithVideoMap.faceExerciseVideoMap);
    await persistFaceAnalysis(auth.uid, dateKey, parsed, resultWithVideoMap, vision ? "vision_ai" : "placeholder");
    return res.status(200).json(resultWithVideoMap);
  } catch (error) {
    console.error("POST /api/longevity/face-analyze failed", error);
    try {
      const dateKey = getDateKey(parsed.today);
      const healthRecord = await loadHealthRecord(auth.uid, dateKey);
      const fallback = buildFaceAnalysis({
        uid: auth.uid,
        imageUrl: parsed.imageUrl,
        today: parsed.today,
        history: parsed.history,
        healthRecord,
      });
      const fallbackWithVideoMap: FaceAnalyzeResponse = {
        ...fallback,
        faceExerciseVideoMap: parsed.faceExerciseVideoMap,
      };
      console.log("[face-analyze] fallback response exercise->video map", fallbackWithVideoMap.faceExerciseVideoMap);
      await persistFaceAnalysis(auth.uid, dateKey, parsed, fallbackWithVideoMap, "placeholder");
      return res.status(200).json(fallbackWithVideoMap);
    } catch (fallbackError) {
      console.error("POST /api/longevity/face-analyze fallback failed", fallbackError);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
