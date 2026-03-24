import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../../lib/auth";
import {
  BodyPlanEnvironment,
  BodyPlanFocus,
  BodyPlanPace,
  applyBodyPlanPreferences,
  buildBodyPlanRecommendation,
  buildMissedDayQuickWorkout,
  isPlainObject,
} from "../../lib/longevity-v2";

type RequestShape = {
  bodyFatRangeEstimate: string;
  postureScore: number;
  muscleDefinitionScore: number;
  missedSessions7d?: number;
  adherenceRate?: number;
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

function parseRequest(body: unknown): RequestShape | null {
  if (!isPlainObject(body)) return null;
  if (typeof body.bodyFatRangeEstimate !== "string" || !body.bodyFatRangeEstimate.trim()) return null;
  if (!Number.isFinite(Number(body.postureScore))) return null;
  if (!Number.isFinite(Number(body.muscleDefinitionScore))) return null;

  const preferences = isPlainObject(body.preferences) ? body.preferences : undefined;
  return {
    bodyFatRangeEstimate: body.bodyFatRangeEstimate.trim(),
    postureScore: clamp(Math.round(Number(body.postureScore)), 0, 100),
    muscleDefinitionScore: clamp(Math.round(Number(body.muscleDefinitionScore)), 0, 100),
    missedSessions7d: Number.isFinite(Number(body.missedSessions7d))
      ? clamp(Math.round(Number(body.missedSessions7d)), 0, 7)
      : undefined,
    adherenceRate: Number.isFinite(Number(body.adherenceRate))
      ? clamp(Math.round(Number(body.adherenceRate)), 0, 100)
      : undefined,
    preferences: {
      pace:
        preferences?.pace === "easy" || preferences?.pace === "balanced" || preferences?.pace === "fast"
          ? preferences.pace
          : undefined,
      focus:
        preferences?.focus === "strength" ||
        preferences?.focus === "cardio" ||
        preferences?.focus === "balanced" ||
        preferences?.focus === "mobility"
          ? preferences.focus
          : undefined,
      environment:
        preferences?.environment === "gym" ||
        preferences?.environment === "home" ||
        preferences?.environment === "both"
          ? preferences.environment
          : undefined,
      kneeFriendly: preferences?.kneeFriendly === true,
      backFriendly: preferences?.backFriendly === true,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const parsed = parseRequest(req.body);
  if (!parsed) return res.status(400).json({ error: "Invalid payload" });

  const baseRecommendation = buildBodyPlanRecommendation({
    postureScore: parsed.postureScore,
    muscleDefinitionScore: parsed.muscleDefinitionScore,
    bodyFatRangeEstimate: parsed.bodyFatRangeEstimate,
    healthScore: 70,
  });
  const recommendation = applyBodyPlanPreferences(baseRecommendation, parsed.preferences);
  const workout = buildMissedDayQuickWorkout({
    recommendation,
    postureScore: parsed.postureScore,
    muscleDefinitionScore: parsed.muscleDefinitionScore,
    bodyFatRangeEstimate: parsed.bodyFatRangeEstimate,
    preferences: parsed.preferences,
    missedSessions7d: parsed.missedSessions7d,
    adherenceRate: parsed.adherenceRate,
  });

  return res.status(200).json({ workout, recommendation });
}
