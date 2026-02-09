export type JsonObject = Record<string, unknown>;

export type FaceFatEstimate = "low" | "medium" | "high";

export type FaceAnalyzeResponse = {
  jawlineIndex: number;
  skinClarityIndex: number;
  faceFatEstimate: FaceFatEstimate;
  notes: string[];
};

export type BodyAnalyzeResponse = {
  bodyFatRangeEstimate: string;
  postureScore: number;
  muscleDefinitionScore: number;
  notes: string[];
};

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isObjectArray(value: unknown): value is JsonObject[] {
  return Array.isArray(value) && value.every((item) => isPlainObject(item));
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getDateKey(today: JsonObject): string {
  const candidates = [
    today.date,
    today.recordDate,
    today.todayDate,
    today.isoDate,
  ];
  const found = candidates.find(
    (candidate) =>
      typeof candidate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate)
  );

  if (typeof found === "string") return found;
  return new Date().toISOString().slice(0, 10);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as JsonObject).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scoreFromSeed(seed: string, min: number, max: number): number {
  const hashed = hash32(seed);
  const ratio = hashed / 4294967295;
  const value = min + Math.round((max - min) * ratio);
  return Math.max(min, Math.min(max, value));
}

export function buildCoachReply(input: {
  question: string;
  today: JsonObject;
  history: JsonObject[];
  messages: JsonObject[];
  healthRecord: JsonObject | null;
}): string {
  const { question, today, history, messages, healthRecord } = input;
  const calories = Number(today.calories ?? healthRecord?.calories ?? 0);
  const protein = Number(today.protein ?? healthRecord?.protein ?? 0);

  const firstLine = `Coach note: ${question.trim()}`;
  const secondLine = Number.isFinite(calories) && Number.isFinite(protein)
    ? `Today snapshot: calories ${Math.round(calories)}, protein ${Math.round(
        protein
      )}g.`
    : "Today snapshot is partial, so I am focusing on consistent habits.";
  const thirdLine = `Context used: ${history.length} history items and ${messages.length} message items.`;
  const fourthLine = "Next step: keep hydration steady and log your next meal for tighter recommendations.";

  return [firstLine, secondLine, thirdLine, fourthLine].join(" ");
}

export function buildFaceAnalysis(input: {
  uid: string;
  imageUrl: string;
  today: JsonObject;
  history: JsonObject[];
  healthRecord: JsonObject | null;
}): FaceAnalyzeResponse {
  const seedBase = [
    input.uid,
    input.imageUrl.trim(),
    stableStringify(input.today),
    stableStringify(input.history),
    stableStringify(input.healthRecord),
    "face",
  ].join("|");

  const jawlineIndex = scoreFromSeed(`${seedBase}|jawline`, 38, 92);
  const skinClarityIndex = scoreFromSeed(`${seedBase}|skin`, 42, 94);
  const combined = Math.round((jawlineIndex + skinClarityIndex) / 2);

  const faceFatEstimate: FaceFatEstimate =
    combined >= 72 ? "low" : combined >= 52 ? "medium" : "high";

  const notes = [
    `Deterministic placeholder analysis generated from current input context.`,
    `Jawline signal: ${jawlineIndex}/100, skin clarity signal: ${skinClarityIndex}/100.`,
    `Estimated face fat tendency: ${faceFatEstimate}.`,
  ];

  return { jawlineIndex, skinClarityIndex, faceFatEstimate, notes };
}

export function buildBodyAnalysis(input: {
  uid: string;
  imageUrl: string;
  today: JsonObject;
  history: JsonObject[];
  healthRecord: JsonObject | null;
}): BodyAnalyzeResponse {
  const seedBase = [
    input.uid,
    input.imageUrl.trim(),
    stableStringify(input.today),
    stableStringify(input.history),
    stableStringify(input.healthRecord),
    "body",
  ].join("|");

  const postureScore = scoreFromSeed(`${seedBase}|posture`, 40, 93);
  const muscleDefinitionScore = scoreFromSeed(`${seedBase}|muscle`, 35, 91);
  const bodySignal = Math.round((100 - postureScore + 100 - muscleDefinitionScore) / 2);

  let bodyFatRangeEstimate = "18-24%";
  if (bodySignal < 25) bodyFatRangeEstimate = "10-16%";
  else if (bodySignal < 45) bodyFatRangeEstimate = "14-20%";
  else if (bodySignal < 65) bodyFatRangeEstimate = "18-24%";
  else bodyFatRangeEstimate = "22-30%";

  const notes = [
    `Deterministic placeholder analysis generated from current input context.`,
    `Posture score: ${postureScore}/100, muscle definition score: ${muscleDefinitionScore}/100.`,
    `Estimated body fat range: ${bodyFatRangeEstimate}.`,
  ];

  return {
    bodyFatRangeEstimate,
    postureScore,
    muscleDefinitionScore,
    notes,
  };
}
