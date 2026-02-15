export type JsonObject = Record<string, unknown>;

export type FaceFatEstimate = "low" | "medium" | "high";

export type FaceAnalyzeResponse = {
  jawlineIndex: number;
  skinClarityIndex: number;
  faceFatEstimate: FaceFatEstimate;
  overallScore: number;
  measurements: {
    potential: number;
    jawline: number;
    eyeArea: number;
    cheekbones: number;
    symmetry: number;
    facialThirds: number;
    skinQuality: number;
  };
  suggestions: {
    skin: string[];
    jawline: string[];
    training: string[];
    routine: string[];
  };
  exercisePlan: {
    oneWeek: string[];
    oneMonth: string[];
  };
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickComputed(today: JsonObject, healthRecord: JsonObject | null): JsonObject {
  const t = isPlainObject(today.computed) ? (today.computed as JsonObject) : null;
  if (t) return t;
  const r = healthRecord && isPlainObject(healthRecord.computed)
    ? (healthRecord.computed as JsonObject)
    : null;
  return r ?? {};
}

function parseRiskFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string") as string[];
}


function buildExercisePlan(input: {
  jawlineIndex: number;
  skinClarityIndex: number;
  faceFatEstimate: FaceFatEstimate;
  healthScore: number;
}): { oneWeek: string[]; oneMonth: string[] } {
  const intensity = input.healthScore >= 75 ? "moderate-high" : input.healthScore >= 55 ? "moderate" : "moderate-low";

  const oneWeek = [
    "Mon: 1) Mewing Hold [TIME 90s x 4] 2) Chin Tucks [REPS 20 x 3] 3) Neck Curls [REPS 15 x 3] 4) Nasal Breathing [TIME 300s x 2].",
    "Tue: 1) Jaw Mobility Drill [TIME 120s x 2] 2) Tongue Posture Clicks [REPS 30 x 3] 3) Neck Extensions [REPS 15 x 3] 4) Zone-2 Nasal Cardio [TIME 600s x 2].",
    "Wed: 1) Mewing Pulses [TIME 60s x 5] 2) Wall Posture Holds [TIME 45s x 4] 3) Neck Isometric Press [TIME 30s x 4] 4) Jaw Control [REPS 16 x 3].",
    "Thu: 1) Chewing Protocol [TIME 300s x 2] 2) Jaw Retractions [REPS 15 x 3] 3) Chin Tuck Holds [TIME 30s x 4] 4) Recovery Walk [TIME 900s x 2].",
    "Fri: 1) Mewing Endurance [TIME 120s x 4] 2) Neck Flex/Ext [REPS 12 x 4] 3) Jaw Open-Close Control [REPS 20 x 3] 4) Breath Intervals [TIME 180s x 4] + Full-body (" + intensity + ").",
    "Sat: 1) Lymph Drain Sequence [TIME 300s x 2] 2) Nasal Walk [TIME 900s x 2] 3) Tongue Resets [REPS 40 x 2] 4) Jaw Isometrics [TIME 30s x 5].",
    "Sun: 1) Face+Neck Mobility [TIME 300s x 2] 2) Posture Tune-up [TIME 60s x 4] 3) Gentle Walk [TIME 1200s x 1] 4) Technique Audit [REPS 12 x 1].",
  ];

  const oneMonth = [
    "Week 1: Technique phase. Build daily mewing consistency, posture alignment, and nasal breathing.",
    "Week 2: Volume phase. Increase neck/jaw accessory work by 10-20% and keep strength sessions stable.",
    "Week 3: Definition phase. Tighten sleep/sodium consistency and maintain mild conditioning progression.",
    "Week 4: Consolidation. Deload lifting 20-30%, keep face drills daily, evaluate symmetry/jawline trend.",
  ];

  if (input.faceFatEstimate === "high" || input.jawlineIndex < 60) {
    oneWeek[5] = "Sat: 1) Lymph Drain Sequence [TIME 360s x 2] 2) Nasal Walk [TIME 1080s x 2] 3) Tongue Resets [REPS 40 x 2] 4) Jaw Isometrics [TIME 30s x 5] + strict de-bloat day.";
    oneMonth[2] = "Week 3: Keep deficit mild, stabilize sodium/water, preserve muscle while reducing facial puffiness.";
  }

  if (input.skinClarityIndex < 60) {
    oneWeek[1] = "Tue: 1) Jaw Mobility Drill [TIME 120s x 2] 2) Tongue Clicks [REPS 25 x 3] 3) Zone-2 Cardio [TIME 900s x 2] 4) Skin Recovery Block [TIME 300s x 1] + hydration/SPF focus.";
  }

  return { oneWeek, oneMonth };
}


export function buildCoachReply(input: {
  question: string;
  today: JsonObject;
  history: JsonObject[];
  messages: JsonObject[];
  healthRecord: JsonObject | null;
  activeExperiment?: JsonObject | null;
}): string {
  const { question, today, history, messages, healthRecord, activeExperiment } = input;

  const computed = pickComputed(today, healthRecord);
  const hydrationPercent = toNumber(computed.hydrationPercent);
  const sleepQuality = toNumber(computed.sleepQuality);
  const moodQuality = toNumber(computed.moodQuality);
  const weightStability = toNumber(computed.weightStability, 70);
  const healthScore = toNumber(computed.healthScore, 70);
  const riskFlags = parseRiskFlags(computed.riskFlags);

  const hints: string[] = [];
  const plan: string[] = [];

  if (hydrationPercent < 70) {
    hints.push("Hydration trend is low on at least one recent day. Add about 500ml on active days.");
    plan.push("Drink 500ml water in the first 60 minutes after waking.");
  }
  if (sleepQuality < 70) {
    hints.push("Sleep consistency is below target. Keep bedtime and wake time fixed.");
    plan.push("Run a 7-night fixed sleep window with no late caffeine.");
  }
  if (moodQuality < 60) {
    hints.push("Stress load is elevated. Add decompression and short walks.");
    plan.push("Schedule 10 minutes of low-intensity stress-down work daily.");
  }
  if (weightStability < 70) {
    hints.push("Weight variability is elevated. Keep sodium and meal timing steady.");
    plan.push("Keep meals inside the same 2-hour timing window each day.");
  }

  if (hints.length === 0) {
    hints.push("Your trend is stable. Keep hydration, protein, and sleep consistency.");
    plan.push("Maintain your current routine and log all major meals for 7 days.");
  }

  const expName = isPlainObject(activeExperiment) && isNonEmptyString(activeExperiment.name)
    ? activeExperiment.name.trim()
    : "";
  if (expName) {
    plan.unshift(`Keep experiment \"${expName}\" adherence above 80% this week.`);
  }

  const riskText = riskFlags.length > 0 ? riskFlags.join(", ") : "none";
  const priority = hints[0] ?? "Hydration + sleep consistency.";
  const q = question.trim();

  return [
    "AI Health Coach",
    "",
    `Question: ${q}`,
    "",
    `Insight: ${hints.join(" ")}`,
    "",
    `Today Priority: ${priority}`,
    "",
    "Next 7 Days:",
    `1. ${plan[0] ?? "Hit hydration goal daily."}`,
    `2. ${plan[1] ?? "Protect sleep window and caffeine cutoff."}`,
    `3. ${plan[2] ?? "Complete movement + protein target daily."}`,
    "",
    `Risk Flags: ${riskText}`,
    `Context: ${history.length} history records, ${messages.length} chat messages, score ${Math.round(healthScore)}/100.`,
  ].join("\n");
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

  const computed = pickComputed(input.today, input.healthRecord);
  const healthScore = toNumber(computed.healthScore, 70);

  const jawlineIndex = clamp(
    Math.round((scoreFromSeed(`${seedBase}|jawline`, 40, 94) * 0.75 + healthScore * 0.25)),
    30,
    98
  );
  const skinClarityIndex = clamp(
    Math.round((scoreFromSeed(`${seedBase}|skin`, 42, 95) * 0.72 + healthScore * 0.28)),
    30,
    98
  );

  const potential = clamp(
    Math.round(jawlineIndex * 0.4 + skinClarityIndex * 0.35 + healthScore * 0.25),
    30,
    99
  );
  const eyeArea = clamp(
    Math.round((scoreFromSeed(`${seedBase}|eye`, 38, 94) * 0.7 + skinClarityIndex * 0.3)),
    30,
    99
  );
  const cheekbones = clamp(
    Math.round((scoreFromSeed(`${seedBase}|cheek`, 40, 95) * 0.7 + jawlineIndex * 0.3)),
    30,
    99
  );
  const symmetry = clamp(
    Math.round((scoreFromSeed(`${seedBase}|sym`, 40, 94) * 0.65 + potential * 0.35)),
    30,
    99
  );
  const facialThirds = clamp(
    Math.round((scoreFromSeed(`${seedBase}|thirds`, 38, 93) * 0.65 + symmetry * 0.35)),
    30,
    99
  );
  const skinQuality = clamp(
    Math.round((scoreFromSeed(`${seedBase}|skinq`, 38, 95) * 0.6 + skinClarityIndex * 0.4)),
    30,
    99
  );

  const overallScore = clamp(
    Math.round(
      potential * 0.2 +
        jawlineIndex * 0.18 +
        eyeArea * 0.12 +
        cheekbones * 0.12 +
        symmetry * 0.13 +
        facialThirds * 0.1 +
        skinQuality * 0.15
    ),
    0,
    100
  );

  const combined = Math.round((jawlineIndex + skinClarityIndex) / 2);
  const faceFatEstimate: FaceFatEstimate =
    combined >= 72 ? "low" : combined >= 52 ? "medium" : "high";

  const skinSuggestions = [
    "Use daily SPF in the morning and keep evening cleansing consistent.",
    "Push sleep consistency to improve next-day skin clarity.",
    "Keep high-sugar meals away from late evening windows.",
  ];

  const jawlineSuggestions = [
    "Keep hydration and sodium stable to reduce facial water retention.",
    "Add neck/posture alignment drills 5-10 minutes daily.",
    "Prioritize slow body-fat reduction with high-protein meals.",
  ];

  const trainingSuggestions = [
    "Do 3-4 weekly strength sessions with progressive overload.",
    "Add 2 zone-2 cardio sessions and 1 short interval session.",
    "Target 8k-12k daily steps on non-training days.",
  ];

  const routineSuggestions = [
    "Morning: sunlight + hydration + protein-first meal.",
    "Afternoon: movement break every 90 minutes.",
    "Evening: caffeine cutoff and fixed wind-down routine.",
  ];

  const notes = [
    "Placeholder vision scoring was generated deterministically from your current context.",
    `Overall ${overallScore}/100. Jawline ${jawlineIndex}/100, skin clarity ${skinClarityIndex}/100.`,
    `Estimated facial fat tendency: ${faceFatEstimate}.`,
  ];

  const exercisePlan = buildExercisePlan({
    jawlineIndex,
    skinClarityIndex,
    faceFatEstimate,
    healthScore,
  });

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
      skin: skinSuggestions,
      jawline: jawlineSuggestions,
      training: trainingSuggestions,
      routine: routineSuggestions,
    },
    exercisePlan,
    notes,
  };
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
    "Placeholder body analysis was generated deterministically from current input context.",
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
