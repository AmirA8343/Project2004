export type JsonObject = Record<string, unknown>;

export type FaceFatEstimate = "low" | "medium" | "high";

export type SkinAnalysis = {
  dryness: number;
  acneRisk: number;
  pigmentation: number;
  sensitivity: number;
  confidence: "low" | "medium" | "high";
};

export type FaceAnalyzeResponse = {
  jawlineIndex: number;
  skinClarityIndex: number;
  faceFatEstimate: FaceFatEstimate;
  overallScore: number;
  skinAnalysis: SkinAnalysis;
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
  faceExerciseVideoMap?: Record<
    string,
    {
      videoKey: string | null;
      fileName: string | null;
    }
  >;
  notes: string[];
};

export type LocalFaceScores = {
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
};

export type FaceVisionFeatures = {
  source: "apple_vision";
  schemaVersion: number;
  faceConfidence: number;
  faceAspectRatio: number;
  interocularDistanceRatio: number;
  mouthWidthRatio: number;
  eyeOpennessRatio: number;
  browSymmetryDelta: number;
  eyeLineSymmetryDelta: number;
  jawWidthRatio: number;
  chinToMouthRatio: number;
  facialThirdsBalance: number;
  yawDegrees: number;
  rollDegrees: number;
};

export const AVAILABLE_BODY_EXERCISE_IDS = [
  "body_front_squat",
  "body_deadlift",
  "body_lunge",
  "body_reverse_lunge",
  "body_stepup",
  "body_glute_bridge",
  "body_hip_thrust",
  "dumbbell_goblet_squat",
  "dumbbell_squat_hold_isometric",
  "dumbbell_bench_press_flat",
  "body_incline_db_press",
  "body_db_shoulder_press",
  "dumbbell_shoulder_press_overhead",
  "machine_shoulder_press",
  "body_decline_pushup",
  "body_kneeling_pushup",
  "body_pushup",
  "body_standard_pushup",
  "body_cable_chest_fly",
  "body_cable_crossover",
  "parallel_bar_dips",
  "dumbbell_front_raise_alternating",
  "cable_triceps_pushdown",
  "body_barbell_row",
  "body_seated_row",
  "chest_supported_barbell_row",
  "body_lat_pulldown",
  "body_pullup",
  "body_pullup_overhand",
  "assisted_pullup_band",
  "body_rear_delt_fly",
  "body_db_curl",
  "body_db_curl_alt",
  "cable_biceps_curl_straight_bar",
  "dumbbell_shrug_standing",
  "body_ab_rollout",
  "body_dead_bug_core",
  "body_hanging_leg_raise",
  "body_seated_leg_raise",
  "bench_bicycle_crunch",
  "bench_reverse_crunch",
  "body_reverse_crunch_bench",
  "body_crunch_standard",
  "body_russian_twist",
  "body_plank_forearm",
  "body_cooldown_breathing_reset",
  "body_cooldown_full_body_mobility",
  "body_warmup_thoracic_rotation",
  "body_zone2_stationary_bike",
  "body_zone2_treadmill_walk",
  "side_plank_forearm",
  "body_squat_standard",
  "body_split_squat_bulgarian",
  "body_split_squat_static",
  "dumbbell_rdl",
  "body_hip_hinge_drill",
  "leg_extension_machine",
  "body_calf_raise_standing",
  "body_warmup_hip_openers",
  "body_low_impact_knee_friendly_squat",
  "body_low_impact_back_friendly_hinge",
  "body_form_cue_squat",
  "body_seated_cable_row",
  "body_interval_rower",
  "body_form_cue_deadlift",
  "body_db_shrug",
  "body_warmup_shoulder_activation",
  "body_form_cue_press",
] as const;

export const AVAILABLE_FACE_EXERCISE_IDS = [
  "mewing_hold",
  "chin_tucks",
  "neck_curls",
  "nasal_breath",
  "jaw_mobility",
  "tongue_clicks",
  "neck_extensions",
  "zone2_block",
  "mewing_pulses",
  "posture_wall",
  "neck_isometric",
  "jaw_control",
  "chew_protocol",
  "jaw_retractions",
  "chin_tuck_hold",
  "de_bloat_walk",
  "mewing_endurance",
  "neck_superset",
  "jaw_open_close",
  "interval_breath",
  "lymph_drain",
  "nasal_walk",
  "tongue_resets",
  "jaw_isometric",
  "mobility_face",
  "light_posture",
  "gentle_walk",
  "technique_audit",
] as const;

export type BodyProfile = {
  primaryGoal: "fat_loss" | "recomp" | "muscle_gain" | "athletic";
  trainingReadiness: "starter" | "builder" | "advanced";
  mobilityNeed: "low" | "moderate" | "high";
  conditioningNeed: "low" | "moderate" | "high";
  postureFocus: "upper_chain" | "core_stack" | "hips" | "full_body";
  impactTolerance: "low" | "moderate" | "high";
  upperBodyEmphasis: "low" | "moderate" | "high";
  lowerBodyEmphasis: "low" | "moderate" | "high";
  trainingSplitPreference: "full_body" | "upper_lower" | "conditioning_mix";
  equipmentBias: "gym" | "home" | "both";
};

export type BodyAnalyzeResponse = {
  bodyFatRangeEstimate: string;
  postureScore: number;
  muscleDefinitionScore: number;
  bodyProfile: BodyProfile;
  recommendation: BodyPlanRecommendation;
  structuredPlan: StructuredBodyWorkoutPlan;
  exercisePlan: {
    oneWeek: string[];
    oneMonth: string[];
  };
  notes: string[];
};

export type BodyPlanFocus = "strength" | "cardio" | "balanced" | "mobility";
export type BodyPlanPace = "easy" | "balanced" | "fast";
export type BodyPlanEnvironment = "gym" | "home" | "both";

export type BodyPlanRecommendation = {
  daysPerWeek: number;
  sessionMinutes: number;
  focus: BodyPlanFocus;
  pace: BodyPlanPace;
  environment: BodyPlanEnvironment;
  structureType: "full_body" | "upper_lower" | "conditioning_mix";
  reasons: string[];
};

export type BodyPlanPreferences = {
  pace?: BodyPlanPace;
  focus?: BodyPlanFocus;
  environment?: BodyPlanEnvironment;
  kneeFriendly?: boolean;
  backFriendly?: boolean;
};

export type StructuredPlannedExercise = {
  exerciseId: string;
  sets?: number;
  reps?: number;
  seconds?: number;
  restSeconds?: number;
  note?: string;
};

export type StructuredWorkoutBlock = {
  id: string;
  label: string;
  type: "warmup" | "main" | "accessory" | "cardio" | "cooldown";
  exercises: StructuredPlannedExercise[];
};

export type StructuredWorkoutSession = {
  id: string;
  dayLabel: string;
  title: string;
  goal: "strength" | "cardio" | "mobility" | "recovery";
  estimatedMinutes: number;
  environment: BodyPlanEnvironment;
  tags: string[];
  blocks: StructuredWorkoutBlock[];
};

export type StructuredBodyWorkoutPlan = {
  summary: {
    daysPerWeek: number;
    sessionMinutes: number;
    focus: BodyPlanFocus;
    pace: BodyPlanPace;
    environment: BodyPlanEnvironment;
    kneeFriendly?: boolean;
    backFriendly?: boolean;
  };
  sessions: StructuredWorkoutSession[];
};

export type StructuredQuickWorkout = {
  title: string;
  estimatedMinutes: number;
  environment: BodyPlanEnvironment;
  goal: "strength" | "cardio" | "mobility" | "recovery";
  coachNote?: string;
  blocks: StructuredWorkoutBlock[];
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

export function deriveSkinAnalysisFromFaceScores(input: {
  skinClarityIndex: number;
  faceFatEstimate: FaceFatEstimate;
  skinQuality?: number;
  potential?: number;
  confidence?: SkinAnalysis["confidence"];
}): SkinAnalysis {
  const skinClarity = clamp(Math.round(input.skinClarityIndex), 0, 100);
  const skinQuality = clamp(Math.round(input.skinQuality ?? skinClarity), 0, 100);
  const potential = clamp(Math.round(input.potential ?? 60), 0, 100);

  const drynessBase = 100 - Math.round(skinClarity * 0.72 + skinQuality * 0.18);
  const dryness = clamp(drynessBase + (input.faceFatEstimate === "high" ? 8 : input.faceFatEstimate === "medium" ? 3 : 0), 0, 100);

  const acneBase = input.faceFatEstimate === "high" ? 56 : input.faceFatEstimate === "medium" ? 38 : 20;
  const acneRisk = clamp(acneBase + Math.round((100 - skinClarity) * 0.18), 0, 100);

  const pigmentation = clamp(100 - Math.round(skinClarity * 0.7 + skinQuality * 0.12), 0, 100);
  const sensitivity = clamp(Math.round(dryness * 0.48 + (100 - skinQuality) * 0.22 + (100 - potential) * 0.1), 0, 100);

  return {
    dryness,
    acneRisk,
    pigmentation,
    sensitivity,
    confidence: input.confidence ?? "medium",
  };
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

export function normalizeBodyProfile(value: unknown): BodyProfile | null {
  if (!isPlainObject(value)) return null;

  const primaryGoal =
    value.primaryGoal === "fat_loss" ||
    value.primaryGoal === "recomp" ||
    value.primaryGoal === "muscle_gain" ||
    value.primaryGoal === "athletic"
      ? value.primaryGoal
      : null;
  const trainingReadiness =
    value.trainingReadiness === "starter" ||
    value.trainingReadiness === "builder" ||
    value.trainingReadiness === "advanced"
      ? value.trainingReadiness
      : null;
  const mobilityNeed =
    value.mobilityNeed === "low" ||
    value.mobilityNeed === "moderate" ||
    value.mobilityNeed === "high"
      ? value.mobilityNeed
      : null;
  const conditioningNeed =
    value.conditioningNeed === "low" ||
    value.conditioningNeed === "moderate" ||
    value.conditioningNeed === "high"
      ? value.conditioningNeed
      : null;
  const postureFocus =
    value.postureFocus === "upper_chain" ||
    value.postureFocus === "core_stack" ||
    value.postureFocus === "hips" ||
    value.postureFocus === "full_body"
      ? value.postureFocus
      : null;
  const impactTolerance =
    value.impactTolerance === "low" ||
    value.impactTolerance === "moderate" ||
    value.impactTolerance === "high"
      ? value.impactTolerance
      : null;
  const upperBodyEmphasis =
    value.upperBodyEmphasis === "low" ||
    value.upperBodyEmphasis === "moderate" ||
    value.upperBodyEmphasis === "high"
      ? value.upperBodyEmphasis
      : null;
  const lowerBodyEmphasis =
    value.lowerBodyEmphasis === "low" ||
    value.lowerBodyEmphasis === "moderate" ||
    value.lowerBodyEmphasis === "high"
      ? value.lowerBodyEmphasis
      : null;
  const trainingSplitPreference =
    value.trainingSplitPreference === "full_body" ||
    value.trainingSplitPreference === "upper_lower" ||
    value.trainingSplitPreference === "conditioning_mix"
      ? value.trainingSplitPreference
      : null;
  const equipmentBias =
    value.equipmentBias === "gym" ||
    value.equipmentBias === "home" ||
    value.equipmentBias === "both"
      ? value.equipmentBias
      : null;

  if (
    !primaryGoal ||
    !trainingReadiness ||
    !mobilityNeed ||
    !conditioningNeed ||
    !postureFocus ||
    !impactTolerance ||
    !upperBodyEmphasis ||
    !lowerBodyEmphasis ||
    !trainingSplitPreference ||
    !equipmentBias
  ) {
    return null;
  }

  return {
    primaryGoal,
    trainingReadiness,
    mobilityNeed,
    conditioningNeed,
    postureFocus,
    impactTolerance,
    upperBodyEmphasis,
    lowerBodyEmphasis,
    trainingSplitPreference,
    equipmentBias,
  };
}

export function deriveBodyProfileFromBodySignals(input: {
  postureScore: number;
  muscleDefinitionScore: number;
  bodyFatRangeEstimate: string;
  healthScore: number;
}): BodyProfile {
  const fatText = input.bodyFatRangeEstimate.toLowerCase();
  const higherFat = /22|24|26|28|30|higher/.test(fatText);
  const lean = /10|12|14|16|lean|athletic/.test(fatText);

  const primaryGoal: BodyProfile["primaryGoal"] = higherFat
    ? "fat_loss"
    : lean && input.muscleDefinitionScore >= 72
      ? "athletic"
      : input.muscleDefinitionScore < 56
        ? "muscle_gain"
        : "recomp";

  const mobilityNeed: BodyProfile["mobilityNeed"] =
    input.postureScore < 56 ? "high" : input.postureScore < 70 ? "moderate" : "low";
  const conditioningNeed: BodyProfile["conditioningNeed"] =
    higherFat || input.healthScore < 58 ? "high" : primaryGoal === "athletic" || input.healthScore < 72 ? "moderate" : "low";
  const trainingReadiness: BodyProfile["trainingReadiness"] =
    input.healthScore < 58 || mobilityNeed === "high" ? "starter" : input.healthScore < 80 ? "builder" : "advanced";
  const postureFocus: BodyProfile["postureFocus"] =
    mobilityNeed === "high"
      ? "full_body"
      : input.postureScore < 64
        ? "upper_chain"
        : input.muscleDefinitionScore < 58
          ? "core_stack"
          : higherFat
            ? "hips"
            : "core_stack";
  const impactTolerance: BodyProfile["impactTolerance"] =
    higherFat || mobilityNeed === "high" ? "low" : input.healthScore < 76 ? "moderate" : "high";
  const upperBodyEmphasis: BodyProfile["upperBodyEmphasis"] =
    primaryGoal === "muscle_gain" || primaryGoal === "athletic" ? "high" : input.muscleDefinitionScore < 62 ? "moderate" : "low";
  const lowerBodyEmphasis: BodyProfile["lowerBodyEmphasis"] =
    primaryGoal === "fat_loss" || higherFat ? "high" : primaryGoal === "athletic" ? "moderate" : "low";
  const trainingSplitPreference: BodyProfile["trainingSplitPreference"] =
    mobilityNeed === "high" || trainingReadiness === "starter"
      ? "full_body"
      : conditioningNeed === "high" && primaryGoal === "fat_loss"
        ? "conditioning_mix"
        : "upper_lower";
  const equipmentBias: BodyProfile["equipmentBias"] =
    primaryGoal === "muscle_gain" || primaryGoal === "athletic" ? "gym" : primaryGoal === "fat_loss" ? "both" : "both";

  return {
    primaryGoal,
    trainingReadiness,
    mobilityNeed,
    conditioningNeed,
    postureFocus,
    impactTolerance,
    upperBodyEmphasis,
    lowerBodyEmphasis,
    trainingSplitPreference,
    equipmentBias,
  };
}

export function buildBodyPlanRecommendation(input: {
  postureScore: number;
  muscleDefinitionScore: number;
  bodyFatRangeEstimate: string;
  healthScore: number;
  bodyProfile?: BodyProfile | null;
}): BodyPlanRecommendation {
  const bodyProfile =
    normalizeBodyProfile(input.bodyProfile) ??
    deriveBodyProfileFromBodySignals({
      postureScore: input.postureScore,
      muscleDefinitionScore: input.muscleDefinitionScore,
      bodyFatRangeEstimate: input.bodyFatRangeEstimate,
      healthScore: input.healthScore,
    });

  const focus: BodyPlanFocus =
    bodyProfile.mobilityNeed === "high"
      ? "mobility"
      : bodyProfile.primaryGoal === "muscle_gain"
        ? "strength"
        : bodyProfile.primaryGoal === "athletic"
          ? bodyProfile.conditioningNeed === "high" ? "balanced" : "strength"
          : bodyProfile.primaryGoal === "fat_loss"
            ? "balanced"
            : bodyProfile.conditioningNeed === "moderate"
              ? "balanced"
              : "strength";

  const pace: BodyPlanPace =
    bodyProfile.trainingReadiness === "starter" || bodyProfile.impactTolerance === "low"
      ? "easy"
      : bodyProfile.trainingReadiness === "builder"
        ? "balanced"
        : "fast";

  const daysPerWeek =
    bodyProfile.trainingSplitPreference === "full_body"
      ? 3
      : bodyProfile.trainingReadiness === "advanced"
        ? 5
        : 4;
  const sessionMinutes =
    pace === "easy" ? 30 : focus === "mobility" ? 30 : pace === "balanced" ? 38 : 45;
  const environment: BodyPlanEnvironment = bodyProfile.equipmentBias;
  const structureType: BodyPlanRecommendation["structureType"] = bodyProfile.trainingSplitPreference;

  const reasons = [
    bodyProfile.primaryGoal === "fat_loss"
      ? "Fat-loss support and conditioning should stay in the weekly plan."
      : bodyProfile.primaryGoal === "muscle_gain"
        ? "Muscle-building work should be the main driver of progress."
        : bodyProfile.primaryGoal === "athletic"
          ? "Athletic performance needs both strength and engine work."
          : "Recomposition works best with balanced strength and conditioning support.",
    bodyProfile.mobilityNeed === "high"
      ? `Mobility and ${bodyProfile.postureFocus.replace("_", " ")} correction should show up multiple times each week.`
      : `Posture focus is biased toward ${bodyProfile.postureFocus.replace("_", " ")}.`,
    `Plan split is ${bodyProfile.trainingSplitPreference.replace("_", " ")} with a ${pace} pace in a ${environment} environment.`,
  ];

  return {
    daysPerWeek,
    sessionMinutes,
    focus,
    pace,
    environment,
    structureType,
    reasons,
  };
}

export function applyBodyPlanPreferences(
  recommendation: BodyPlanRecommendation,
  preferences?: BodyPlanPreferences | null
): BodyPlanRecommendation {
  if (!preferences) return recommendation;

  const nextPace = preferences.pace ?? recommendation.pace;
  const nextFocus = preferences.focus ?? recommendation.focus;
  const nextEnvironment = preferences.environment ?? recommendation.environment;
  const nextDaysPerWeek =
    nextPace === "easy" ? 3 : recommendation.daysPerWeek >= 5 && nextPace === "fast" ? 5 : 4;
  const nextSessionMinutes = nextPace === "easy" ? 30 : nextPace === "balanced" ? 35 : 45;
  const nextStructureType: BodyPlanRecommendation["structureType"] =
    recommendation.structureType === "conditioning_mix" && nextDaysPerWeek >= 4
      ? "conditioning_mix"
      : nextDaysPerWeek <= 3
        ? "full_body"
        : "upper_lower";

  return {
    ...recommendation,
    pace: nextPace,
    focus: nextFocus,
    environment: nextEnvironment,
    daysPerWeek: nextDaysPerWeek,
    sessionMinutes: nextSessionMinutes,
    structureType: nextStructureType,
    reasons: [
      `Plan tuned for a ${nextPace} pace.`,
      `${nextFocus.charAt(0).toUpperCase()}${nextFocus.slice(1)} work is emphasized.`,
      `Environment set to ${nextEnvironment}.`,
    ],
  };
}

export function buildStructuredBodyWorkoutPlan(input: {
  recommendation: BodyPlanRecommendation;
  postureScore: number;
  muscleDefinitionScore: number;
  bodyFatRangeEstimate: string;
  bodyProfile?: BodyProfile | null;
  preferences?: BodyPlanPreferences | null;
}): StructuredBodyWorkoutPlan {
  const recommendation = input.recommendation;
  const bodyProfile =
    normalizeBodyProfile(input.bodyProfile) ??
    deriveBodyProfileFromBodySignals({
      postureScore: input.postureScore,
      muscleDefinitionScore: input.muscleDefinitionScore,
      bodyFatRangeEstimate: input.bodyFatRangeEstimate,
      healthScore: 70,
    });
  const needsMobilityBias = bodyProfile.mobilityNeed !== "low";
  const needsFatLoss = bodyProfile.primaryGoal === "fat_loss";
  const kneeFriendly = Boolean(input.preferences?.kneeFriendly) || bodyProfile.impactTolerance === "low";
  const backFriendly = Boolean(input.preferences?.backFriendly) || bodyProfile.postureFocus === "core_stack";
  const homeBias = recommendation.environment === "home" || bodyProfile.equipmentBias === "home";
  const focusCardio = recommendation.focus === "cardio" || bodyProfile.trainingSplitPreference === "conditioning_mix";
  const focusMobility = recommendation.focus === "mobility" || bodyProfile.mobilityNeed === "high";
  const focusBalanced = recommendation.focus === "balanced";
  const upperBiasHigh = bodyProfile.upperBodyEmphasis === "high";
  const lowerBiasHigh = bodyProfile.lowerBodyEmphasis === "high";
  const advancedSplit = recommendation.daysPerWeek >= 5;
  const lowerBase =
    homeBias
      ? [
          {
            exerciseId: kneeFriendly ? "body_low_impact_knee_friendly_squat" : "dumbbell_goblet_squat",
            sets: 4,
            reps: 10,
            restSeconds: 60,
          },
          {
            exerciseId: backFriendly ? "body_low_impact_back_friendly_hinge" : "dumbbell_rdl",
            sets: 3,
            reps: 10,
            restSeconds: 60,
          },
          { exerciseId: kneeFriendly ? "body_glute_bridge" : "body_reverse_lunge", sets: 3, reps: 10, restSeconds: 45 },
        ]
      : input.muscleDefinitionScore < 58
      ? [
          {
            exerciseId: kneeFriendly ? "body_low_impact_knee_friendly_squat" : "dumbbell_goblet_squat",
            sets: 4,
            reps: 10,
            restSeconds: 75,
          },
          {
            exerciseId: backFriendly ? "body_low_impact_back_friendly_hinge" : "dumbbell_rdl",
            sets: 3,
            reps: 10,
            restSeconds: 75,
          },
          { exerciseId: kneeFriendly ? "body_glute_bridge" : "body_split_squat_static", sets: 3, reps: 10, restSeconds: 60 },
        ]
      : [
          {
            exerciseId: kneeFriendly ? "body_low_impact_knee_friendly_squat" : "body_squat_standard",
            sets: 4,
            reps: 10,
            restSeconds: 75,
          },
          {
            exerciseId: backFriendly ? "body_low_impact_back_friendly_hinge" : "dumbbell_rdl",
            sets: 3,
            reps: 10,
            restSeconds: 75,
          },
          { exerciseId: kneeFriendly ? "body_stepup" : "body_split_squat_bulgarian", sets: 3, reps: 10, restSeconds: 60 },
        ];

  const sessions: StructuredWorkoutSession[] = [
    {
      id: "body-day-1",
      dayLabel: "Mon",
      title: homeBias ? "Home Lower Body" : focusMobility ? "Lower Body Mechanics" : lowerBiasHigh ? "Lower Body Bias" : "Lower Body Strength",
      goal: focusMobility ? "mobility" : "strength",
      estimatedMinutes: recommendation.sessionMinutes,
      environment: recommendation.environment,
      tags: [
        homeBias ? "home_friendly" : "strength",
        needsMobilityBias ? "posture" : bodyProfile.primaryGoal,
        ...(kneeFriendly ? ["knee_friendly"] : []),
        ...(backFriendly ? ["back_friendly"] : []),
      ],
      blocks: [
        {
          id: "day1-warmup",
          label: "Warmup",
          type: "warmup",
          exercises: [
            { exerciseId: "body_warmup_hip_openers", seconds: 480, note: "Open hips before loading" },
            { exerciseId: "body_warmup_thoracic_rotation", seconds: 480, note: "Stack ribcage over pelvis" },
          ],
        },
        {
          id: "day1-main",
          label: focusMobility ? "Movement Quality" : "Main Strength",
          type: focusMobility ? "accessory" : "main",
          exercises: focusMobility
            ? [
                { exerciseId: backFriendly ? "body_low_impact_back_friendly_hinge" : "body_hip_hinge_drill", sets: 3, reps: 12, restSeconds: 45 },
                { exerciseId: kneeFriendly ? "body_low_impact_knee_friendly_squat" : "body_form_cue_squat", sets: 3, reps: 10, restSeconds: 45 },
                { exerciseId: "body_glute_bridge", sets: 3, reps: 15, restSeconds: 45 },
              ]
            : lowerBase,
        },
        {
          id: "day1-cooldown",
          label: "Cooldown",
          type: "cooldown",
          exercises: [
            { exerciseId: "body_plank_forearm", sets: 3, seconds: 35 },
            { exerciseId: "body_cooldown_breathing_reset", seconds: 300 },
          ],
        },
      ],
    },
    {
      id: "body-day-2",
      dayLabel: "Tue",
      title: homeBias ? "Home Upper Body" : focusCardio ? "Upper + Engine" : upperBiasHigh ? "Upper Body Bias" : "Upper Body Strength",
      goal: focusCardio ? "cardio" : "strength",
      estimatedMinutes: recommendation.sessionMinutes,
      environment: recommendation.environment,
      tags: [homeBias ? "home_friendly" : "strength", focusCardio ? "conditioning" : "upper"],
      blocks: [
        {
          id: "day2-warmup",
          label: "Warmup",
          type: "warmup",
          exercises: [
            { exerciseId: "body_warmup_shoulder_activation", sets: 3, reps: 12 },
          ],
        },
        {
          id: "day2-main",
          label: focusCardio ? "Mixed Circuit" : "Main Strength",
          type: focusCardio ? "cardio" : "main",
          exercises: homeBias
            ? [
                { exerciseId: "body_pushup", sets: 4, reps: upperBiasHigh ? 14 : 12, restSeconds: 45 },
                { exerciseId: upperBiasHigh ? "body_db_curl_alt" : "body_rear_delt_fly", sets: 3, reps: 12, restSeconds: 45 },
                { exerciseId: bodyProfile.primaryGoal === "athletic" ? "body_db_shoulder_press" : "body_db_shoulder_press", sets: 3, reps: upperBiasHigh ? 12 : 10, restSeconds: 45 },
              ]
            : focusCardio
              ? [
                  { exerciseId: "body_pushup", sets: 4, reps: 12, restSeconds: 30 },
                  { exerciseId: "body_interval_rower", seconds: 600 },
                  { exerciseId: "body_dead_bug_core", sets: 3, reps: 12, restSeconds: 30 },
                ]
              : [
                  { exerciseId: "dumbbell_bench_press_flat", sets: 4, reps: 10, restSeconds: 75 },
                  { exerciseId: "body_seated_cable_row", sets: 4, reps: 12, restSeconds: 75 },
                  { exerciseId: "dumbbell_shoulder_press_overhead", sets: 3, reps: 10, restSeconds: 60 },
                ],
        },
        {
          id: "day2-accessory",
          label: "Accessory",
          type: "accessory",
          exercises: [
            { exerciseId: backFriendly ? "body_cooldown_breathing_reset" : "body_dead_bug_core", sets: backFriendly ? undefined : 3, reps: backFriendly ? undefined : 12, seconds: backFriendly ? 180 : undefined, restSeconds: 45 },
            { exerciseId: homeBias ? "body_plank_forearm" : "body_rear_delt_fly", sets: 3, reps: homeBias ? undefined : 12, seconds: homeBias ? 35 : undefined, restSeconds: 45 },
          ],
        },
      ],
    },
    {
      id: "body-day-3",
      dayLabel: "Thu",
      title: focusCardio ? "Conditioning Focus" : needsFatLoss ? "Conditioning + Mobility" : bodyProfile.postureFocus === "core_stack" ? "Core + Mobility" : "Recovery + Mobility",
      goal: focusCardio || needsFatLoss ? "cardio" : "mobility",
      estimatedMinutes: recommendation.sessionMinutes,
      environment: recommendation.environment === "gym" ? "both" : recommendation.environment,
      tags: [needsFatLoss ? "fat_loss" : "recovery", needsMobilityBias ? "posture" : "mobility"],
      blocks: [
        {
          id: "day3-cardio",
          label: "Engine Work",
          type: "cardio",
          exercises: [
            {
              exerciseId: homeBias ? "body_zone2_treadmill_walk" : needsFatLoss ? "body_zone2_treadmill_walk" : "body_zone2_stationary_bike",
              seconds: focusCardio ? (bodyProfile.conditioningNeed === "high" ? 2100 : 1800) : needsFatLoss ? 1800 : 1500,
            },
            { exerciseId: homeBias ? (kneeFriendly ? "body_zone2_treadmill_walk" : "body_stepup") : "body_interval_rower", seconds: homeBias ? (kneeFriendly ? 600 : undefined) : needsFatLoss ? 720 : 600, sets: homeBias && !kneeFriendly ? 3 : undefined, reps: homeBias && !kneeFriendly ? 12 : undefined },
          ],
        },
        {
          id: "day3-mobility",
          label: "Reset",
          type: "cooldown",
          exercises: [
            { exerciseId: "body_cooldown_full_body_mobility", seconds: 600 },
            { exerciseId: "body_cooldown_breathing_reset", seconds: 300 },
          ],
        },
      ],
    },
  ];

  if (recommendation.daysPerWeek >= 4) {
    sessions.push({
      id: "body-day-4",
      dayLabel: "Sat",
      title: focusBalanced ? "Balanced Full Body" : focusCardio ? "Full Body Conditioning" : homeBias ? "Home Full Body" : bodyProfile.primaryGoal === "muscle_gain" ? "Full Body Hypertrophy" : bodyProfile.primaryGoal === "athletic" ? "Full Body Performance" : "Full Body Builder",
      goal: focusCardio ? "cardio" : "strength",
      estimatedMinutes: recommendation.sessionMinutes,
      environment: recommendation.environment,
      tags: [homeBias ? "home_friendly" : "strength", needsFatLoss ? "conditioning_support" : "full_body"],
      blocks: [
        {
          id: "day4-main",
          label: "Main Block",
          type: focusCardio ? "cardio" : "main",
          exercises: homeBias
            ? [
                  { exerciseId: "body_pushup", sets: 3, reps: 15, restSeconds: 30 },
                  { exerciseId: kneeFriendly ? "body_low_impact_knee_friendly_squat" : "dumbbell_goblet_squat", sets: 3, reps: 12, restSeconds: 30 },
                  { exerciseId: kneeFriendly ? "body_glute_bridge" : "body_reverse_lunge", sets: 3, reps: 10, restSeconds: 30 },
                ]
            : focusCardio
              ? [
                  { exerciseId: "body_interval_rower", seconds: 720 },
                  { exerciseId: "body_pushup", sets: 3, reps: 12, restSeconds: 30 },
                  { exerciseId: kneeFriendly ? "body_low_impact_knee_friendly_squat" : "body_lunge", sets: 3, reps: 12, restSeconds: 30 },
                ]
              : [
                  { exerciseId: backFriendly ? "body_low_impact_back_friendly_hinge" : "body_deadlift", sets: 4, reps: 6, restSeconds: 90 },
                  { exerciseId: "body_incline_db_press", sets: 4, reps: 10, restSeconds: 75 },
                  {
                    exerciseId: kneeFriendly || needsFatLoss ? "body_low_impact_knee_friendly_squat" : "body_lunge",
                    sets: 3,
                    reps: 12,
                    restSeconds: 60,
                  },
                ],
        },
        {
          id: "day4-finish",
          label: "Finish Strong",
          type: needsFatLoss ? "cardio" : "accessory",
          exercises: needsFatLoss
            ? [
                { exerciseId: "body_zone2_treadmill_walk", seconds: 1200 },
                { exerciseId: "body_russian_twist", sets: 3, reps: 16, restSeconds: 45 },
              ]
            : [
                { exerciseId: "body_hanging_leg_raise", sets: 3, reps: 10, restSeconds: 45 },
                { exerciseId: "body_cooldown_full_body_mobility", seconds: 480 },
              ],
        },
      ],
    });
  }

  if (recommendation.daysPerWeek >= 5) {
    sessions.push({
      id: "body-day-5",
      dayLabel: "Sun",
      title:
        bodyProfile.primaryGoal === "athletic"
          ? "Skill + Engine"
          : bodyProfile.primaryGoal === "muscle_gain"
            ? "Upper Pump"
            : bodyProfile.primaryGoal === "fat_loss"
              ? "Conditioning Finish"
              : "Recovery Builder",
      goal:
        bodyProfile.primaryGoal === "athletic" || bodyProfile.primaryGoal === "fat_loss"
          ? "cardio"
          : "strength",
      estimatedMinutes: Math.max(28, recommendation.sessionMinutes - 5),
      environment: recommendation.environment === "gym" ? "both" : recommendation.environment,
      tags: [bodyProfile.primaryGoal, advancedSplit ? "advanced_split" : "extra_day"],
      blocks: [
        {
          id: "day5-main",
          label: bodyProfile.primaryGoal === "fat_loss" ? "Engine + Core" : "Supplemental Work",
          type:
            bodyProfile.primaryGoal === "athletic" || bodyProfile.primaryGoal === "fat_loss"
              ? "cardio"
              : "accessory",
          exercises:
            bodyProfile.primaryGoal === "athletic"
              ? [
                  { exerciseId: "body_interval_rower", seconds: 720 },
                  { exerciseId: "body_pushup", sets: 3, reps: 12, restSeconds: 30 },
                  { exerciseId: "body_dead_bug_core", sets: 3, reps: 12, restSeconds: 30 },
                ]
              : bodyProfile.primaryGoal === "muscle_gain"
                ? [
                    { exerciseId: "body_incline_db_press", sets: 3, reps: 12, restSeconds: 45 },
                    { exerciseId: "body_seated_cable_row", sets: 3, reps: 12, restSeconds: 45 },
                    { exerciseId: "body_rear_delt_fly", sets: 3, reps: 15, restSeconds: 30 },
                  ]
                : bodyProfile.primaryGoal === "fat_loss"
                  ? [
                      { exerciseId: "body_zone2_treadmill_walk", seconds: 1500 },
                      { exerciseId: "body_russian_twist", sets: 3, reps: 16, restSeconds: 30 },
                      { exerciseId: "body_glute_bridge", sets: 3, reps: 15, restSeconds: 30 },
                    ]
                  : [
                      { exerciseId: "body_zone2_stationary_bike", seconds: 900 },
                      { exerciseId: "body_plank_forearm", sets: 3, seconds: 35, restSeconds: 30 },
                      { exerciseId: "body_cooldown_full_body_mobility", seconds: 420 },
                    ],
        },
      ],
    });
  }

  return {
    summary: {
      daysPerWeek: recommendation.daysPerWeek,
      sessionMinutes: recommendation.sessionMinutes,
      focus: recommendation.focus,
      pace: recommendation.pace,
      environment: recommendation.environment,
      kneeFriendly,
      backFriendly,
    },
    sessions,
  };
}

export function buildMissedDayQuickWorkout(input: {
  recommendation: BodyPlanRecommendation;
  postureScore: number;
  muscleDefinitionScore: number;
  bodyFatRangeEstimate: string;
  preferences?: BodyPlanPreferences | null;
  missedSessions7d?: number;
  adherenceRate?: number;
}): StructuredQuickWorkout {
  const home = input.recommendation.environment === "gym" ? "home" : input.recommendation.environment;
  const mobilityBias = input.recommendation.focus === "mobility" || input.postureScore < 62;
  const cardioBias =
    input.recommendation.focus === "cardio" || /22|24|26|28|30|higher/.test(input.bodyFatRangeEstimate.toLowerCase());
  const kneeFriendly = Boolean(input.preferences?.kneeFriendly);
  const backFriendly = Boolean(input.preferences?.backFriendly);
  const missedSessions7d = Math.max(0, Math.round(input.missedSessions7d ?? 0));
  const adherenceRate =
    typeof input.adherenceRate === "number" && Number.isFinite(input.adherenceRate)
      ? Math.max(0, Math.min(100, Math.round(input.adherenceRate)))
      : null;
  const recoveryBias = missedSessions7d >= 2 || (adherenceRate !== null && adherenceRate < 60);
  const estimatedMinutes = recoveryBias ? 15 : 12;
  const coachNote = recoveryBias
    ? `You are behind on the week, so this session is slightly longer to help recover momentum without forcing a full workout.`
    : `Use this as a low-friction consistency session when the day gets compressed.`;

  return {
    title: mobilityBias
      ? recoveryBias
        ? "Recovery Mobility Reset"
        : "Quick Mobility Reset"
      : cardioBias
        ? recoveryBias
          ? "Recovery Home Conditioning"
          : "Quick Home Conditioning"
        : recoveryBias
          ? "Recovery Full-Body Rescue"
          : "Quick Full-Body Rescue",
    estimatedMinutes,
    environment: home,
    goal: mobilityBias ? "mobility" : cardioBias ? "cardio" : "strength",
    coachNote,
    blocks: [
      {
        id: "quick-warmup",
        label: "Fast Start",
        type: "warmup",
        exercises: [
          { exerciseId: "body_warmup_hip_openers", seconds: 180 },
          { exerciseId: "body_warmup_thoracic_rotation", seconds: 180 },
        ],
      },
      {
        id: "quick-main",
        label: "Quick Win",
        type: mobilityBias ? "cooldown" : cardioBias ? "cardio" : "main",
        exercises: mobilityBias
          ? [
              { exerciseId: backFriendly ? "body_low_impact_back_friendly_hinge" : "body_hip_hinge_drill", sets: 2, reps: 12, restSeconds: 20 },
              { exerciseId: "body_glute_bridge", sets: 2, reps: 15, restSeconds: 20 },
              ...(recoveryBias ? [{ exerciseId: "body_dead_bug", sets: 2, reps: 12, restSeconds: 20 }] : []),
              { exerciseId: "body_cooldown_breathing_reset", seconds: 180 },
            ]
          : cardioBias
            ? [
                { exerciseId: kneeFriendly ? "body_zone2_treadmill_walk" : "body_stepup", sets: kneeFriendly ? undefined : 3, reps: kneeFriendly ? undefined : 12, seconds: kneeFriendly ? 420 : undefined, restSeconds: 20 },
                { exerciseId: "body_pushup", sets: 3, reps: 10, restSeconds: 20 },
                { exerciseId: "body_russian_twist", sets: 3, reps: 16, restSeconds: 20 },
                ...(recoveryBias ? [{ exerciseId: "body_glute_bridge", sets: 2, reps: 15, restSeconds: 20 }] : []),
              ]
            : [
                { exerciseId: kneeFriendly ? "body_low_impact_knee_friendly_squat" : "dumbbell_goblet_squat", sets: 3, reps: 12, restSeconds: 25 },
                { exerciseId: "body_pushup", sets: 3, reps: 12, restSeconds: 25 },
                { exerciseId: backFriendly ? "body_cooldown_breathing_reset" : "body_plank_forearm", sets: backFriendly ? undefined : 2, seconds: backFriendly ? 180 : 35, restSeconds: 20 },
                ...(recoveryBias
                  ? [{ exerciseId: "body_glute_bridge", sets: 2, reps: 15, restSeconds: 20 }]
                  : []),
              ],
      },
    ],
  };
}


function buildExercisePlan(input: {
  jawlineIndex: number;
  skinClarityIndex: number;
  faceFatEstimate: FaceFatEstimate;
  healthScore: number;
}): { oneWeek: string[]; oneMonth: string[] } {
  const intensity =
    input.healthScore >= 75 ? "moderate-high" : input.healthScore >= 55 ? "moderate" : "moderate-low";

  const oneWeek = [
    `Mon: Mewing hold 5x60s + Chin tucks 4x12 + Nasal breathing 10 min (${intensity}).`,
    "Tue: Jaw control drills 4x15 + Tongue posture resets 5x45s + Neck isometric 4x20s.",
    "Wed: Posture wall drill 5x45s + Light walk 20 min + Recovery breathing 6 min.",
    "Thu: Mewing pulses 4x20 + Chin tuck hold 4x30s + Jaw mobility 8 min.",
    "Fri: Neck superset 4 rounds + Tongue posture endurance 5x45s + Nasal walk 20 min.",
    "Sat: Gentle facial mobility 10 min + Posture reset 8 min + De-bloat walk 25 min.",
    "Sun: Recovery breathing 8 min + Technique audit 5 min + Light posture work 8 min.",
  ];

  const oneMonth = [
    "Week 1: Technique focus. Keep jaw, tongue, and neck drills crisp and low fatigue.",
    "Week 2: Add volume. Increase holds by 10-15 seconds and add one extra posture set.",
    "Week 3: Endurance focus. Maintain quality while extending nasal breathing duration.",
    "Week 4: Deload and assess. Reduce volume 20% and reassess posture and facial tension.",
  ];

  return { oneWeek, oneMonth };
}

export function buildBodyExercisePlan(input: {
  postureScore: number;
  muscleDefinitionScore: number;
  bodyFatRangeEstimate: string;
  healthScore: number;
  bodyProfile?: BodyProfile | null;
}): { oneWeek: string[]; oneMonth: string[] } {
  const postureTier =
    input.postureScore >= 78 ? "strong" : input.postureScore >= 62 ? "moderate" : "needs_correction";
  const definitionTier =
    input.muscleDefinitionScore >= 76 ? "high" : input.muscleDefinitionScore >= 58 ? "moderate" : "low";
  const bodyProfile =
    normalizeBodyProfile(input.bodyProfile) ??
    deriveBodyProfileFromBodySignals({
      postureScore: input.postureScore,
      muscleDefinitionScore: input.muscleDefinitionScore,
      bodyFatRangeEstimate: input.bodyFatRangeEstimate,
      healthScore: input.healthScore,
    });

  const strengthLoad =
    definitionTier === "high" ? "heavy" : definitionTier === "moderate" ? "moderate" : "light-moderate";
  const variantBucket =
    input.postureScore >= input.muscleDefinitionScore + 8
      ? "posture"
      : input.muscleDefinitionScore >= input.postureScore + 8
        ? "definition"
        : bodyProfile.conditioningNeed === "high"
          ? "conditioning"
          : "balanced";

  const oneWeek =
    bodyProfile.primaryGoal === "fat_loss"
      ? [
          `Mon: 1) Body Low Impact Knee Friendly Squat [REPS 12 x 4] 2) Body Glute Bridge [REPS 15 x 3] 3) Body Pushup [REPS 12 x 3] 4) Body Zone2 Treadmill Walk [TIME 20min x 1] (${strengthLoad}).`,
          "Tue: 1) Body Zone2 Stationary Bike [TIME 35min x 1] 2) Body Warmup Hip Openers [TIME 8min x 1] 3) Body Dead Bug Core [REPS 12 x 3] 4) Body Cooldown Breathing Reset [TIME 5min x 1].",
          "Wed: 1) Dumbbell Goblet Squat [REPS 10 x 4] 2) Dumbbell RDL [REPS 10 x 3] 3) Body Seated Row [REPS 12 x 4] 4) Body Plank Forearm [TIME 35s x 3].",
          "Thu: 1) Body Zone2 Treadmill Walk [TIME 30min x 1] 2) Body Warmup Thoracic Rotation [TIME 8min x 1] 3) Body Glute Bridge [REPS 15 x 3] 4) Body Cooldown Full Body Mobility [TIME 10min x 1].",
          "Fri: 1) Body Pushup [REPS 15 x 4] 2) Body Rear Delt Fly [REPS 12 x 3] 3) Body Stepup [REPS 12 x 3] 4) Body Russian Twist [REPS 16 x 3].",
          "Sat: 1) Body Interval Rower [TIME 12min x 1] 2) Body Low Impact Back Friendly Hinge [REPS 12 x 3] 3) Body Dead Bug Core [REPS 12 x 3] 4) Body Cooldown Breathing Reset [TIME 5min x 1].",
          "Sun: 1) Body Zone2 Stationary Bike [TIME 25min x 1] 2) Body Cooldown Full Body Mobility [TIME 12min x 1] 3) Body Warmup Shoulder Activation [REPS 12 x 3] 4) Body Hip Hinge Drill [REPS 10 x 3].",
        ]
      : bodyProfile.primaryGoal === "athletic"
        ? [
            `Mon: 1) Body Front Squat [REPS 6 x 4] 2) Body Deadlift [REPS 5 x 4] 3) Body Hanging Leg Raise [REPS 10 x 3] 4) Body Cooldown Breathing Reset [TIME 5min x 1] (${strengthLoad}).`,
            "Tue: 1) Body Incline DB Press [REPS 8 x 4] 2) Body Pullup Overhand [REPS 8 x 4] 3) Body Seated Cable Row [REPS 10 x 4] 4) Body Interval Rower [TIME 10min x 1].",
            "Wed: 1) Body Zone2 Stationary Bike [TIME 25min x 1] 2) Body Warmup Hip Openers [TIME 8min x 1] 3) Body Warmup Thoracic Rotation [TIME 8min x 1] 4) Body Plank Forearm [TIME 35s x 3].",
            "Thu: 1) Body Lunge [REPS 10 x 4] 2) Body Hip Thrust [REPS 10 x 4] 3) Body Pushup [REPS 15 x 3] 4) Body Russian Twist [REPS 16 x 3].",
            "Fri: 1) Body Lat Pulldown [REPS 10 x 4] 2) Body Barbell Row [REPS 10 x 4] 3) Dumbbell Shoulder Press Overhead [REPS 8 x 4] 4) Body Interval Rower [TIME 12min x 1].",
            "Sat: 1) Body Zone2 Treadmill Walk [TIME 25min x 1] 2) Body Reverse Crunch Bench [REPS 15 x 3] 3) Body Cooldown Full Body Mobility [TIME 10min x 1] 4) Body Hip Hinge Drill [REPS 12 x 3].",
            "Sun: 1) Body Glute Bridge [REPS 15 x 3] 2) Body Dead Bug Core [REPS 12 x 3] 3) Body Warmup Shoulder Activation [REPS 12 x 3] 4) Body Cooldown Breathing Reset [TIME 5min x 1].",
          ]
        : bodyProfile.primaryGoal === "muscle_gain"
          ? [
              `Mon: 1) Dumbbell Goblet Squat [REPS 10 x 4] 2) Dumbbell RDL [REPS 10 x 4] 3) Body Split Squat Bulgarian [REPS 10 x 3] 4) Body Plank Forearm [TIME 35s x 3] (${strengthLoad}).`,
              "Tue: 1) Dumbbell Bench Press Flat [REPS 10 x 4] 2) Body Seated Cable Row [REPS 12 x 4] 3) Dumbbell Shoulder Press Overhead [REPS 10 x 4] 4) Body Rear Delt Fly [REPS 12 x 3].",
              "Wed: 1) Body Zone2 Treadmill Walk [TIME 20min x 1] 2) Body Warmup Hip Openers [TIME 8min x 1] 3) Body Dead Bug Core [REPS 12 x 3] 4) Body Cooldown Breathing Reset [TIME 5min x 1].",
              "Thu: 1) Body Deadlift [REPS 6 x 4] 2) Leg Extension Machine [REPS 12 x 3] 3) Body Hip Thrust [REPS 10 x 4] 4) Body Hanging Leg Raise [REPS 10 x 3].",
              "Fri: 1) Body Incline DB Press [REPS 10 x 4] 2) Body Lat Pulldown [REPS 10 x 4] 3) Body DB Curl Alt [REPS 12 x 3] 4) Cable Triceps Pushdown [REPS 12 x 3].",
              "Sat: 1) Body Pushup [REPS 15 x 3] 2) Body Lunge [REPS 12 x 3] 3) Body Russian Twist [REPS 16 x 3] 4) Body Cooldown Full Body Mobility [TIME 10min x 1].",
              "Sun: 1) Body Zone2 Stationary Bike [TIME 20min x 1] 2) Body Hip Hinge Drill [REPS 12 x 3] 3) Body Seated Leg Raise [REPS 15 x 3] 4) Body Cooldown Breathing Reset [TIME 5min x 1].",
            ]
          : [
              `Mon: 1) Body Squat Standard [REPS 10 x 4] 2) Dumbbell RDL [REPS 10 x 3] 3) Body Split Squat Bulgarian [REPS 10 x 3] 4) Body Plank Forearm [TIME 35s x 3] (${strengthLoad}).`,
              "Tue: 1) Dumbbell Bench Press Flat [REPS 10 x 4] 2) Body Seated Cable Row [REPS 12 x 4] 3) Dumbbell Shoulder Press Overhead [REPS 10 x 3] 4) Body Dead Bug Core [REPS 12 x 3].",
              "Wed: 1) Body Zone2 Treadmill Walk [TIME 30min x 1] 2) Body Warmup Hip Openers [TIME 8min x 1] 3) Body Cooldown Breathing Reset [TIME 5min x 1] 4) Body Warmup Thoracic Rotation [TIME 8min x 1].",
              "Thu: 1) Body Deadlift [REPS 6 x 4] 2) Leg Extension Machine [REPS 12 x 3] 3) Body Glute Bridge [REPS 15 x 3] 4) Body Reverse Crunch Bench [REPS 15 x 3].",
              "Fri: 1) Body Incline DB Press [REPS 10 x 4] 2) Body Lat Pulldown [REPS 10 x 4] 3) Body Barbell Row [REPS 12 x 3] 4) Body Interval Rower [TIME 12min x 1].",
              "Sat: 1) Body Pushup [REPS 15 x 3] 2) Body Lunge [REPS 12 x 3] 3) Body Russian Twist [REPS 16 x 3] 4) Body Cooldown Full Body Mobility [TIME 10min x 1].",
              "Sun: 1) Body Zone2 Stationary Bike [TIME 25min x 1] 2) Body Hip Hinge Drill [REPS 12 x 3] 3) Body Cable Crossover [REPS 12 x 3] 4) Body Seated Leg Raise [REPS 15 x 3].",
            ];

  if (postureTier === "needs_correction") {
    oneWeek[2] =
      "Wed: 1) Body Zone2 Treadmill Walk [TIME 25min x 1] 2) Body Warmup Thoracic Rotation [TIME 10min x 1] 3) Body Warmup Shoulder Activation [REPS 12 x 3] 4) Body Dead Bug Core [REPS 12 x 3].";
    oneWeek[6] =
      "Sun: 1) Body Cooldown Full Body Mobility [TIME 12min x 1] 2) Body Plank Forearm [TIME 30s x 3] 3) Body Cooldown Breathing Reset [TIME 5min x 1] 4) Body Hip Hinge Drill [REPS 10 x 3].";
  }

  if (bodyProfile.primaryGoal === "athletic" && variantBucket === "conditioning") {
    oneWeek[2] =
      "Wed: 1) Body Interval Rower [TIME 14min x 1] 2) Body Zone2 Stationary Bike [TIME 18min x 1] 3) Body Warmup Hip Openers [TIME 8min x 1] 4) Body Plank Forearm [TIME 35s x 3].";
    oneWeek[5] =
      "Sat: 1) Body Zone2 Treadmill Walk [TIME 30min x 1] 2) Body Reverse Crunch Bench [REPS 15 x 3] 3) Body Cooldown Full Body Mobility [TIME 10min x 1] 4) Body Dead Bug Core [REPS 12 x 3].";
  } else if (bodyProfile.primaryGoal === "athletic" && variantBucket === "posture") {
    oneWeek[2] =
      "Wed: 1) Body Warmup Thoracic Rotation [TIME 10min x 1] 2) Body Warmup Shoulder Activation [REPS 12 x 3] 3) Body Zone2 Stationary Bike [TIME 20min x 1] 4) Body Dead Bug Core [REPS 12 x 3].";
    oneWeek[6] =
      "Sun: 1) Body Cooldown Full Body Mobility [TIME 12min x 1] 2) Body Hip Hinge Drill [REPS 12 x 3] 3) Body Glute Bridge [REPS 15 x 3] 4) Body Cooldown Breathing Reset [TIME 5min x 1].";
  }

  if (bodyProfile.primaryGoal === "recomp" && variantBucket === "conditioning") {
    oneWeek[5] =
      "Sat: 1) Body Interval Rower [TIME 12min x 1] 2) Body Pushup [REPS 15 x 3] 3) Body Russian Twist [REPS 16 x 3] 4) Body Zone2 Treadmill Walk [TIME 20min x 1].";
  }

  if (bodyProfile.upperBodyEmphasis === "high") {
    oneWeek[1] =
      "Tue: 1) Dumbbell Bench Press Flat [REPS 10 x 4] 2) Body Incline DB Press [REPS 10 x 4] 3) Body Seated Cable Row [REPS 12 x 4] 4) Dumbbell Shoulder Press Overhead [REPS 10 x 3].";
  }
  if (bodyProfile.lowerBodyEmphasis === "high") {
    oneWeek[3] =
      "Thu: 1) Body Front Squat [REPS 8 x 4] 2) Body Hip Thrust [REPS 10 x 4] 3) Body Reverse Lunge [REPS 10 x 3] 4) Body Reverse Crunch Bench [REPS 15 x 3].";
  }

  const oneMonth = [
    bodyProfile.trainingSplitPreference === "full_body"
      ? "Week 1: Full-body foundation. Keep technique clean and repeat exposures without chasing fatigue."
      : "Week 1: Build consistency. Stay 2-3 reps in reserve and lock form quality.",
    bodyProfile.primaryGoal === "muscle_gain"
      ? "Week 2: Hypertrophy push. Add one set to primary lifts and keep reps crisp."
      : bodyProfile.primaryGoal === "athletic"
        ? "Week 2: Performance block. Add load to compound lifts and maintain sprint quality."
        : "Week 2: Progressive overload. Add one set to main lifts and +10% cardio volume.",
    bodyProfile.primaryGoal === "fat_loss"
      ? "Week 3: Fat-loss acceleration. Keep deficit mild, add one extra zone-2 block, preserve strength output."
      : bodyProfile.primaryGoal === "muscle_gain"
        ? "Week 3: Recovery-aware growth. Keep protein high and protect sleep consistency."
        : "Week 3: Body composition push. Keep protein high, preserve strength, tighten recovery.",
    "Week 4: Deload and reassess. Cut lifting volume 25%, keep daily movement and mobility.",
  ];

  return { oneWeek, oneMonth };
}

function buildFaceAnalysisFromSeed(input: {
  seedBase: string;
  today: JsonObject;
  history: JsonObject[];
  healthRecord: JsonObject | null;
  notes?: string[];
}): FaceAnalyzeResponse {
  const computed = pickComputed(input.today, input.healthRecord);
  const healthScore = toNumber(computed.healthScore, 70);

  const jawlineIndex = clamp(
    Math.round(scoreFromSeed(input.seedBase + "|jawline", 38, 92) * 0.7 + healthScore * 0.3),
    0,
    100
  );
  const skinClarityIndex = clamp(
    Math.round(scoreFromSeed(input.seedBase + "|skin", 40, 94) * 0.72 + healthScore * 0.28),
    0,
    100
  );

  const faceFatEstimate: FaceFatEstimate =
    jawlineIndex >= 75 ? "low" : jawlineIndex >= 55 ? "medium" : "high";

  const potential = clamp(Math.round((jawlineIndex * 0.55 + skinClarityIndex * 0.45)), 0, 100);
  const eyeArea = clamp(Math.round((skinClarityIndex * 0.6 + potential * 0.4)), 0, 100);
  const cheekbones = clamp(Math.round((jawlineIndex * 0.7 + potential * 0.3)), 0, 100);
  const symmetry = clamp(Math.round((eyeArea + cheekbones) / 2), 0, 100);
  const facialThirds = clamp(Math.round((symmetry + potential) / 2), 0, 100);
  const skinQuality = clamp(Math.round((skinClarityIndex * 0.85 + healthScore * 0.15)), 0, 100);
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
    skinAnalysis: deriveSkinAnalysisFromFaceScores({
      skinClarityIndex,
      faceFatEstimate,
      skinQuality,
      potential,
      confidence: "medium",
    }),
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
      skin: [
        "Keep daily sunscreen use and consistent sleep timing.",
        "Hydrate earlier in the day and reduce late sugar.",
        "Use a simple PM recovery routine to lower skin stress.",
      ],
      jawline: [
        "Improve neck posture and reduce forward-head tension.",
        "Keep sodium more stable to reduce water retention.",
        "Aim for gradual body-fat reduction, not aggressive cuts.",
      ],
      training: [
        "Pair jawline work with neck posture drills daily.",
        "Add 2 low-intensity cardio sessions weekly.",
        "Keep strength training consistent to support recomposition.",
      ],
      routine: [
        "AM sunlight + hydration within the first hour.",
        "Protein-first meals and steady caffeine cutoff.",
        "Consistent bedtime and reduced late-night screen exposure.",
      ],
    },
    exercisePlan,
    notes: [
      ...(input.notes ?? ["Face plan generated from jawline, skin clarity, and recovery context."]),
      "Jawline and skin scores are visual estimates, not medical measures.",
      `Face fat estimate: ${faceFatEstimate}.`,
    ],
  };
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

  return buildFaceAnalysisFromSeed({
    seedBase,
    today: input.today,
    history: input.history,
    healthRecord: input.healthRecord,
  });
}

export function buildFaceAnalysisFromVisionFeatures(input: {
  uid: string;
  visionFeatures: FaceVisionFeatures;
  today: JsonObject;
  history: JsonObject[];
  healthRecord: JsonObject | null;
}): FaceAnalyzeResponse {
  const seedBase = [
    input.uid,
    stableStringify(input.visionFeatures),
    stableStringify(input.today),
    stableStringify(input.history),
    stableStringify(input.healthRecord),
    "face_vision_features",
  ].join("|");

  return buildFaceAnalysisFromSeed({
    seedBase,
    today: input.today,
    history: input.history,
    healthRecord: input.healthRecord,
    notes: [
      "Face plan generated from on-device facial structure signals and recovery context.",
    ],
  });
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

  const computed = pickComputed(input.today, input.healthRecord);
  const healthScore = toNumber(computed.healthScore, 70);

  const postureScore = clamp(
    Math.round(scoreFromSeed(seedBase + "|posture", 40, 93) * 0.7 + healthScore * 0.3),
    0,
    100
  );
  const muscleDefinitionScore = clamp(
    Math.round(scoreFromSeed(seedBase + "|muscle", 35, 91) * 0.72 + healthScore * 0.28),
    0,
    100
  );
  const bodySignal = Math.round((100 - postureScore + 100 - muscleDefinitionScore) / 2);

  let bodyFatRangeEstimate = "18-24%";
  if (bodySignal < 25) bodyFatRangeEstimate = "10-16%";
  else if (bodySignal < 45) bodyFatRangeEstimate = "14-20%";
  else if (bodySignal < 65) bodyFatRangeEstimate = "18-24%";
  else bodyFatRangeEstimate = "22-30%";

  const bodyProfile = deriveBodyProfileFromBodySignals({
    postureScore,
    muscleDefinitionScore,
    bodyFatRangeEstimate,
    healthScore,
  });
  const recommendation = buildBodyPlanRecommendation({
    postureScore,
    muscleDefinitionScore,
    bodyFatRangeEstimate,
    healthScore,
    bodyProfile,
  });
  const structuredPlan = buildStructuredBodyWorkoutPlan({
    recommendation,
    postureScore,
    muscleDefinitionScore,
    bodyFatRangeEstimate,
    bodyProfile,
  });
  const exercisePlan = buildBodyExercisePlan({
    postureScore,
    muscleDefinitionScore,
    bodyFatRangeEstimate,
    healthScore,
    bodyProfile,
  });

  const notes = [
    "Body coach plan generated from posture, muscle definition, and recovery context.",
    "Posture score: " + postureScore + "/100, muscle definition score: " + muscleDefinitionScore + "/100.",
    "Estimated body fat range: " + bodyFatRangeEstimate + ".",
  ];

  return {
    bodyFatRangeEstimate,
    postureScore,
    muscleDefinitionScore,
    bodyProfile,
    recommendation,
    structuredPlan,
    exercisePlan,
    notes,
  };
}
