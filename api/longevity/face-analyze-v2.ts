import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { getFirebaseFirestore } from "../../lib/firebaseAdmin";
import {
  AVAILABLE_FACE_EXERCISE_IDS,
  buildFaceAnalysis,
  buildFaceAnalysisFromVisionFeatures,
  type FaceAnalyzeResponse,
  type FaceVisionFeatures,
  getDateKey,
  isNonEmptyString,
  isObjectArray,
  isPlainObject,
  JsonObject,
} from "../../lib/longevity-v2";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

type FaceAnalyzeRequest = {
  faceAnalysisMode?: "on_device" | "cloud_ai";
  imageUrl?: string;
  visionFeatures?: FaceVisionFeatures;
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

function normalizeScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const scaled = n > 0 && n <= 10 ? n * 10 : n;
  return clamp(Math.round(scaled), 0, 100);
}

function extractJson(text: string): any | null {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const raw = text.match(/\{[\s\S]*\}/);
  if (raw?.[0]) {
    try {
      return JSON.parse(raw[0]);
    } catch {}
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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
    out.push({ exerciseId, videoKey: value.videoKey, fileName: value.fileName });
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
    if (!allowed.has(exerciseId) || !isPlainObject(rawEntry)) continue;
    const videoKey = isNonEmptyString(rawEntry.videoKey) ? rawEntry.videoKey.trim() : null;
    const fileName = isNonEmptyString(rawEntry.fileName) ? rawEntry.fileName.trim() : null;
    out[exerciseId] = { videoKey, fileName };
  }

  return out;
}

function parseVisionFeatures(value: unknown): FaceVisionFeatures | undefined {
  if (!isPlainObject(value)) return undefined;
  const source = value.source === "apple_vision" ? "apple_vision" : null;
  if (!source) return undefined;

  const toSafe = (entry: unknown, fallback = 0) => {
    const n = Number(entry);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    source,
    schemaVersion: Math.max(1, Math.round(toSafe(value.schemaVersion, 1))),
    faceConfidence: clamp(toSafe(value.faceConfidence, 0), 0, 1),
    faceAspectRatio: clamp(toSafe(value.faceAspectRatio, 1), 0.1, 4),
    interocularDistanceRatio: clamp(toSafe(value.interocularDistanceRatio, 0.3), 0, 2),
    mouthWidthRatio: clamp(toSafe(value.mouthWidthRatio, 0.4), 0, 2),
    eyeOpennessRatio: clamp(toSafe(value.eyeOpennessRatio, 0.08), 0, 1),
    browSymmetryDelta: clamp(toSafe(value.browSymmetryDelta, 0), 0, 1),
    eyeLineSymmetryDelta: clamp(toSafe(value.eyeLineSymmetryDelta, 0), 0, 1),
    jawWidthRatio: clamp(toSafe(value.jawWidthRatio, 0.6), 0, 2),
    chinToMouthRatio: clamp(toSafe(value.chinToMouthRatio, 0.25), 0, 2),
    facialThirdsBalance: clamp(toSafe(value.facialThirdsBalance, 0.5), 0, 1),
    yawDegrees: clamp(toSafe(value.yawDegrees, 0), -90, 90),
    rollDegrees: clamp(toSafe(value.rollDegrees, 0), -90, 90),
  };
}

function parseFaceAnalyzeRequest(body: unknown): FaceAnalyzeRequest | null {
  if (!isPlainObject(body)) return null;
  const {
    faceAnalysisMode,
    imageUrl,
    visionFeatures,
    today,
    history,
    availableExerciseIds,
    availableFaceVideoExercises,
    faceExerciseVideoMap,
  } = body;

  if (!isPlainObject(today) || !isObjectArray(history)) return null;

  const normalizedExerciseIds = normalizeAvailableExerciseIds(availableExerciseIds);
  const normalizedVideoExercises = parseAvailableFaceVideoExercises(
    availableFaceVideoExercises,
    normalizedExerciseIds
  );
  const normalizedVideoMap = parseFaceExerciseVideoMap(faceExerciseVideoMap, normalizedExerciseIds);
  const parsedVisionFeatures = parseVisionFeatures(visionFeatures);
  const videoExerciseCatalog = normalizedVideoExercises.length
    ? normalizedVideoExercises
    : buildFallbackVideoExercisesFromMap(normalizedVideoMap, normalizedExerciseIds);

  const parsedImageUrl = isNonEmptyString(imageUrl) ? imageUrl.trim() : undefined;
  const mode =
    faceAnalysisMode === "on_device" || faceAnalysisMode === "cloud_ai"
      ? faceAnalysisMode
      : parsedVisionFeatures
        ? "on_device"
        : "cloud_ai";

  if (mode === "on_device" && !parsedVisionFeatures) return null;
  if (mode === "cloud_ai" && !parsedImageUrl) return null;

  return {
    faceAnalysisMode: mode,
    imageUrl: parsedImageUrl,
    visionFeatures: parsedVisionFeatures,
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
  } catch {
    return null;
  }
}

async function persistFaceAnalysis(
  uid: string,
  dateKey: string,
  input: FaceAnalyzeRequest,
  result: FaceAnalyzeResponse,
  source: "vision_features_ai" | "vision_image_ai" | "placeholder"
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
          faceAnalyzeV2: {
            faceAnalysisMode: input.faceAnalysisMode ?? null,
            imageUrl: input.imageUrl ?? null,
            visionFeatures: input.visionFeatures ?? null,
            today: input.today,
            history: input.history,
            source,
            result,
          },
        },
        { merge: true }
      );
  } catch (error) {
    console.warn("persistFaceAnalysis v2 failed", {
      message: (error as any)?.message ?? String(error),
      code: (error as any)?.code ?? null,
    });
  }
}

async function runCloudImageFaceAnalysis(input: {
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
  "jawlineIndex": number, // 0..100
  "skinClarityIndex": number, // 0..100
  "faceFatEstimate": "low"|"medium"|"high",
  "overallScore": number, // 0..100
  "measurements": {
    "potential": number, // 0..100
    "jawline": number, // 0..100
    "eyeArea": number, // 0..100
    "cheekbones": number, // 0..100
    "symmetry": number, // 0..100
    "facialThirds": number, // 0..100
    "skinQuality": number // 0..100
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
- Return only valid JSON.
- Keep values realistic and consistent.
- suggestions arrays must have exactly 3 concise items each.
- exercisePlan.oneWeek must have exactly 7 day lines starting with Mon..Sun.
- Each day line must include 4 exercises minimum.
- Every exercise must include its ID tag, e.g. [ID:mewing_hold].
- Use ONLY this video-backed face exercise catalog:
${input.availableFaceVideoExercises.map((item) => `- ${item.exerciseId} -> ${item.fileName}`).join("\n")}`;

  const contextText = JSON.stringify({
    todayComputed: isPlainObject(input.today.computed) ? input.today.computed : {},
    historyDays: input.history.length,
    availableFaceExercises: input.availableExerciseIds,
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

  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  return normalizeOpenAiFaceResponse(data);
}

async function runFeatureFaceAnalysis(input: {
  visionFeatures: FaceVisionFeatures;
  today: JsonObject;
  history: JsonObject[];
  healthRecord: JsonObject | null;
  availableExerciseIds: string[];
  availableFaceVideoExercises: Array<{ exerciseId: string; videoKey: string; fileName: string }>;
  faceExerciseVideoMap: Record<string, { videoKey: string | null; fileName: string | null }>;
}): Promise<FaceAnalyzeResponse | null> {
  if (!OPENAI_API_KEY) return null;

  const prompt = `You are an aesthetics and wellness analysis assistant. You will NOT receive a face image.
You will receive Apple Vision-derived facial structure signals from on-device analysis.
Interpret them conservatively and produce wellness coaching output.

Important:
- The photo itself was not uploaded.
- Do not claim medical certainty.
- Be conservative about skin quality because you do not have raw skin pixels.
- Keep skinClarityIndex realistic and avoid extreme values unless strongly supported by context.
- Use the facial structure signals mainly for jawline, symmetry, posture, and facial thirds interpretation.

Return STRICT JSON only using this schema:
{
  "jawlineIndex": number, // 0..100
  "skinClarityIndex": number, // 0..100
  "faceFatEstimate": "low"|"medium"|"high",
  "overallScore": number, // 0..100
  "measurements": {
    "potential": number, // 0..100
    "jawline": number, // 0..100
    "eyeArea": number, // 0..100
    "cheekbones": number, // 0..100
    "symmetry": number, // 0..100
    "facialThirds": number, // 0..100
    "skinQuality": number // 0..100
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
- Return only valid JSON.
- suggestions arrays must have exactly 3 concise items each.
- exercisePlan.oneWeek must have exactly 7 day lines starting with Mon..Sun.
- Each day line must include 4 exercises minimum.
- Every exercise must include its ID tag, e.g. [ID:mewing_hold].
- Use ONLY this video-backed face exercise catalog:
${input.availableFaceVideoExercises.map((item) => `- ${item.exerciseId} -> ${item.fileName}`).join("\n")}`;

  const contextText = JSON.stringify({
    todayComputed: isPlainObject(input.today.computed) ? input.today.computed : {},
    historyDays: input.history.length,
    visionFeatures: input.visionFeatures,
    availableFaceExercises: input.availableExerciseIds,
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
          content: `Context: ${contextText}\n\nInterpret these on-device face signals and return JSON only.`,
        },
      ],
    }),
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  const normalized = normalizeOpenAiFaceResponse(data);
  if (!normalized) return null;
  normalized.notes = [
    "Face analysis interpreted from on-device Apple Vision structure signals.",
    ...normalized.notes.filter(Boolean),
  ].slice(0, 4);
  return normalized;
}

function normalizeOpenAiFaceResponse(data: any): FaceAnalyzeResponse | null {
  const content = data?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== "object") return null;

  const jawlineIndex = normalizeScore(parsed.jawlineIndex);
  const skinClarityIndex = normalizeScore(parsed.skinClarityIndex);
  const faceFatEstimate =
    parsed.faceFatEstimate === "low" || parsed.faceFatEstimate === "medium" || parsed.faceFatEstimate === "high"
      ? parsed.faceFatEstimate
      : jawlineIndex >= 72
        ? "low"
        : jawlineIndex >= 52
          ? "medium"
          : "high";

  const m = isPlainObject(parsed.measurements) ? parsed.measurements : {};
  const potential = normalizeScore(Number(m.potential) || ((jawlineIndex + skinClarityIndex) / 2));
  const eyeArea = normalizeScore(Number(m.eyeArea) || ((skinClarityIndex + potential) / 2));
  const cheekbones = normalizeScore(Number(m.cheekbones) || ((jawlineIndex + potential) / 2));
  const symmetry = normalizeScore(Number(m.symmetry) || ((eyeArea + cheekbones) / 2));
  const facialThirds = normalizeScore(Number(m.facialThirds) || ((symmetry + potential) / 2));
  const skinQuality = normalizeScore(Number(m.skinQuality) || skinClarityIndex);

  const overallScore = clamp(
    Math.round(
      normalizeScore(parsed.overallScore) ||
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
  const suggestions = {
    skin: toStringArray(s.skin).slice(0, 3),
    jawline: toStringArray(s.jawline).slice(0, 3),
    training: toStringArray(s.training).slice(0, 3),
    routine: toStringArray(s.routine).slice(0, 3),
  };

  const exercisePlan = isPlainObject(parsed.exercisePlan)
    ? {
        oneWeek: toStringArray(parsed.exercisePlan.oneWeek).slice(0, 7),
        oneMonth: toStringArray(parsed.exercisePlan.oneMonth).slice(0, 4),
      }
    : { oneWeek: [], oneMonth: [] };

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
    suggestions,
    exercisePlan,
    notes: toStringArray(parsed.notes).slice(0, 4),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let auth: Awaited<ReturnType<typeof requireAuth>>;
  try {
    auth = await requireAuth(req, res);
  } catch {
    return;
  }

  const parsed = parseFaceAnalyzeRequest(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const dateKey = getDateKey(parsed.today);
  const healthRecord = await loadHealthRecord(auth.uid, dateKey);

  try {
    const result =
      parsed.faceAnalysisMode === "on_device" && parsed.visionFeatures
        ? (await runFeatureFaceAnalysis({
            visionFeatures: parsed.visionFeatures,
            today: parsed.today,
            history: parsed.history,
            healthRecord,
            availableExerciseIds: parsed.availableExerciseIds,
            availableFaceVideoExercises: parsed.availableFaceVideoExercises,
            faceExerciseVideoMap: parsed.faceExerciseVideoMap,
          })) ??
          buildFaceAnalysisFromVisionFeatures({
            uid: auth.uid,
            visionFeatures: parsed.visionFeatures,
            today: parsed.today,
            history: parsed.history,
            healthRecord,
          })
        : (await runCloudImageFaceAnalysis({
            imageUrl: parsed.imageUrl!,
            today: parsed.today,
            history: parsed.history,
            healthRecord,
            availableExerciseIds: parsed.availableExerciseIds,
            availableFaceVideoExercises: parsed.availableFaceVideoExercises,
            faceExerciseVideoMap: parsed.faceExerciseVideoMap,
          })) ??
          buildFaceAnalysis({
            uid: auth.uid,
            imageUrl: parsed.imageUrl!,
            today: parsed.today,
            history: parsed.history,
            healthRecord,
          });

    await persistFaceAnalysis(
      auth.uid,
      dateKey,
      parsed,
      result,
      parsed.faceAnalysisMode === "on_device" ? "vision_features_ai" : "vision_image_ai"
    );

    res.status(200).json({
      ...result,
      faceExerciseVideoMap: parsed.faceExerciseVideoMap,
      faceAnalysisMode: parsed.faceAnalysisMode,
    });
  } catch (error) {
    console.error("POST /api/longevity/face-analyze-v2 failed", error);
    const fallback =
      parsed.faceAnalysisMode === "on_device" && parsed.visionFeatures
        ? buildFaceAnalysisFromVisionFeatures({
            uid: auth.uid,
            visionFeatures: parsed.visionFeatures,
            today: parsed.today,
            history: parsed.history,
            healthRecord,
          })
        : buildFaceAnalysis({
            uid: auth.uid,
            imageUrl: parsed.imageUrl!,
            today: parsed.today,
            history: parsed.history,
            healthRecord,
          });

    await persistFaceAnalysis(auth.uid, dateKey, parsed, fallback, "placeholder");
    res.status(200).json({
      ...fallback,
      faceExerciseVideoMap: parsed.faceExerciseVideoMap,
      faceAnalysisMode: parsed.faceAnalysisMode,
    });
  }
}
