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

export type BodyAnalyzeResponse = {
  bodyFatRangeEstimate: string;
  postureScore: number;
  muscleDefinitionScore: number;
  exercisePlan: {
    oneWeek: string[];
    oneMonth: string[];
  };
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
}): { oneWeek: string[]; oneMonth: string[] } {
  const postureTier =
    input.postureScore >= 78 ? "strong" : input.postureScore >= 62 ? "moderate" : "needs_correction";
  const definitionTier =
    input.muscleDefinitionScore >= 76 ? "high" : input.muscleDefinitionScore >= 58 ? "moderate" : "low";

  const fatText = input.bodyFatRangeEstimate.toLowerCase();
  const profile = /22|24|26|28|30|higher/.test(fatText)
    ? "fat_loss"
    : /10|12|14|16|lean|athletic/.test(fatText)
      ? "athletic"
      : "recomp";

  const strengthLoad =
    definitionTier === "high" ? "heavy" : definitionTier === "moderate" ? "moderate" : "light-moderate";

  const oneWeek = [
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

  if (profile === "fat_loss") {
    oneWeek[5] =
      "Sat: 1) Body Pushup [REPS 15 x 4] 2) Body Low Impact Knee Friendly Squat [REPS 12 x 3] 3) Body Zone2 Treadmill Walk [TIME 30min x 1] 4) Body Cooldown Full Body Mobility [TIME 10min x 1].";
  } else if (profile === "athletic") {
    oneWeek[4] =
      "Fri: 1) Body Incline DB Press [REPS 8 x 4] 2) Body Pullup Overhand [REPS 8 x 4] 3) Body Seated Cable Row [REPS 10 x 4] 4) Body Interval Rower [TIME 10min x 1].";
  }

  if (definitionTier === "low") {
    oneWeek[0] =
      "Mon: 1) Dumbbell Goblet Squat [REPS 10 x 4] 2) Dumbbell RDL [REPS 10 x 3] 3) Body Split Squat Static [REPS 10 x 3] 4) Body Zone2 Treadmill Walk [TIME 30min x 1] (light-moderate).";
  }

  const oneMonth = [
    "Week 1: Technique and consistency. Stay 2-3 reps in reserve and lock form quality.",
    "Week 2: Progressive overload. Add one set to main lifts and +10% cardio volume.",
    "Week 3: Body composition push. Keep protein high, preserve strength, tighten recovery.",
    "Week 4: Deload and reassess. Cut lifting volume 25%, keep daily movement and mobility.",
  ];

  if (profile === "fat_loss") {
    oneMonth[2] =
      "Week 3: Fat-loss acceleration. Keep deficit mild, add one extra zone-2 block, preserve strength output.";
  }
  if (profile === "athletic") {
    oneMonth[1] =
      "Week 2: Performance block. Add load to compound lifts and maintain sprint quality.";
  }
  if (postureTier === "needs_correction") {
    oneMonth[0] =
      "Week 1: Posture restoration priority. Daily thoracic + shoulder alignment before all sessions.";
  }

  return { oneWeek, oneMonth };
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
    Math.round(scoreFromSeed(seedBase + "|jawline", 38, 92) * 0.7 + healthScore * 0.3),
    0,
    100
  );
  const skinClarityIndex = clamp(
    Math.round(scoreFromSeed(seedBase + "|skin", 40, 94) * 0.72 + healthScore * 0.28),
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
      "Face plan generated from jawline, skin clarity, and recovery context.",
      "Jawline and skin scores are visual estimates, not medical measures.",
      `Face fat estimate: ${faceFatEstimate}.`,
    ],
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

  const exercisePlan = buildBodyExercisePlan({
    postureScore,
    muscleDefinitionScore,
    bodyFatRangeEstimate,
    healthScore,
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
    exercisePlan,
    notes,
  };
}
