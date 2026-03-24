import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../../lib/auth";
import {
  BodyAnalyzeResponse,
  BodyPlanEnvironment,
  BodyPlanFocus,
  BodyPlanPace,
  applyBodyPlanPreferences,
  buildBodyExercisePlan,
  buildBodyPlanRecommendation,
  buildStructuredBodyWorkoutPlan,
  isPlainObject,
} from "../../lib/longevity-v2";

type BodyPlanGenerateRequest = {
  bodyFatRangeEstimate: string;
  postureScore: number;
  muscleDefinitionScore: number;
  preferences?: {
    pace?: BodyPlanPace;
    focus?: BodyPlanFocus;
    environment?: BodyPlanEnvironment;
    kneeFriendly?: boolean;
    backFriendly?: boolean;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseRequest(body: unknown): BodyPlanGenerateRequest | null {
  if (!isPlainObject(body)) return null;
  if (typeof body.bodyFatRangeEstimate !== "string" || !body.bodyFatRangeEstimate.trim()) return null;
  if (!Number.isFinite(Number(body.postureScore))) return null;
  if (!Number.isFinite(Number(body.muscleDefinitionScore))) return null;

  const preferences = isPlainObject(body.preferences) ? body.preferences : undefined;
  const pace =
    preferences?.pace === "easy" || preferences?.pace === "balanced" || preferences?.pace === "fast"
      ? preferences.pace
      : undefined;
  const focus =
    preferences?.focus === "strength" ||
    preferences?.focus === "cardio" ||
    preferences?.focus === "balanced" ||
    preferences?.focus === "mobility"
      ? preferences.focus
      : undefined;
  const environment =
    preferences?.environment === "gym" ||
    preferences?.environment === "home" ||
    preferences?.environment === "both"
      ? preferences.environment
      : undefined;

  return {
    bodyFatRangeEstimate: body.bodyFatRangeEstimate.trim(),
    postureScore: clamp(Math.round(Number(body.postureScore)), 0, 100),
    muscleDefinitionScore: clamp(Math.round(Number(body.muscleDefinitionScore)), 0, 100),
    preferences: {
      pace,
      focus,
      environment,
      kneeFriendly: preferences?.kneeFriendly === true,
      backFriendly: preferences?.backFriendly === true,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const parsed = parseRequest(req.body);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const baseRecommendation = buildBodyPlanRecommendation({
    postureScore: parsed.postureScore,
    muscleDefinitionScore: parsed.muscleDefinitionScore,
    bodyFatRangeEstimate: parsed.bodyFatRangeEstimate,
    healthScore: 70,
  });
  const recommendation = applyBodyPlanPreferences(baseRecommendation, parsed.preferences);
  const structuredPlan = buildStructuredBodyWorkoutPlan({
    recommendation,
    postureScore: parsed.postureScore,
    muscleDefinitionScore: parsed.muscleDefinitionScore,
    bodyFatRangeEstimate: parsed.bodyFatRangeEstimate,
    preferences: parsed.preferences,
  });
  const exercisePlan = buildBodyExercisePlan({
    postureScore: parsed.postureScore,
    muscleDefinitionScore: parsed.muscleDefinitionScore,
    bodyFatRangeEstimate: parsed.bodyFatRangeEstimate,
    healthScore: 70,
  });

  const result: BodyAnalyzeResponse = {
    bodyFatRangeEstimate: parsed.bodyFatRangeEstimate,
    postureScore: parsed.postureScore,
    muscleDefinitionScore: parsed.muscleDefinitionScore,
    recommendation,
    structuredPlan,
    exercisePlan,
    notes: [
      "Body plan regenerated from user-selected preferences.",
      `Pace: ${recommendation.pace}, focus: ${recommendation.focus}, environment: ${recommendation.environment}.`,
      ...(parsed.preferences?.kneeFriendly || parsed.preferences?.backFriendly
        ? [`Constraints: ${[parsed.preferences?.kneeFriendly ? "knee-friendly" : null, parsed.preferences?.backFriendly ? "back-friendly" : null].filter(Boolean).join(", ")}.`]
        : []),
    ],
  };

  return res.status(200).json(result);
}
