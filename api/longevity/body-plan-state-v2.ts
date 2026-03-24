import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { getFirebaseFirestore } from "../../lib/firebaseAdmin";
import { isPlainObject } from "../../lib/longevity-v2";

type ActiveBodyPlan = {
  bodyFatRangeEstimate: string;
  postureScore: number;
  muscleDefinitionScore: number;
  recommendation?: unknown;
  structuredPlan?: unknown;
  exercisePlan?: {
    oneWeek: string[];
    oneMonth: string[];
  };
  exercisePlanSource?: "backend" | "fallback";
  notes: string[];
};

type BodyPlanStatePayload = {
  activeBodyPlan: ActiveBodyPlan;
  updatedAt: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseExercisePlan(value: unknown): { oneWeek: string[]; oneMonth: string[] } | undefined {
  if (!isPlainObject(value)) return undefined;
  const oneWeek = toStringArray(value.oneWeek);
  const oneMonth = toStringArray(value.oneMonth);
  if (!oneWeek.length || !oneMonth.length) return undefined;
  return { oneWeek, oneMonth };
}

function normalizeState(value: unknown): BodyPlanStatePayload | null {
  if (!isPlainObject(value) || !isPlainObject(value.activeBodyPlan)) return null;
  const plan = value.activeBodyPlan;
  if (typeof plan.bodyFatRangeEstimate !== "string" || !plan.bodyFatRangeEstimate.trim()) return null;
  if (!Number.isFinite(Number(plan.postureScore)) || !Number.isFinite(Number(plan.muscleDefinitionScore))) return null;

  return {
    activeBodyPlan: {
      bodyFatRangeEstimate: plan.bodyFatRangeEstimate.trim(),
      postureScore: clamp(Math.round(Number(plan.postureScore)), 0, 100),
      muscleDefinitionScore: clamp(Math.round(Number(plan.muscleDefinitionScore)), 0, 100),
      recommendation: plan.recommendation,
      structuredPlan: plan.structuredPlan,
      exercisePlan: parseExercisePlan(plan.exercisePlan),
      exercisePlanSource: plan.exercisePlanSource === "backend" ? "backend" : "fallback",
      notes: toStringArray(plan.notes),
    },
    updatedAt: Math.max(1, Math.round(Number(value.updatedAt) || Date.now())),
  };
}

function docRef(uid: string) {
  return getFirebaseFirestore().collection("users").doc(uid).collection("aiState").doc("bodyPlanV2");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    try {
      const snap = await docRef(auth.uid).get();
      if (!snap.exists) return res.status(404).json({ error: "not_found" });
      const data = snap.data();
      const state = normalizeState({
        activeBodyPlan: data?.activeBodyPlan,
        updatedAt:
          Number(data?.clientUpdatedAt) ||
          (typeof data?.serverSavedAt?.toMillis === "function" ? data.serverSavedAt.toMillis() : 0),
      });
      if (!state) return res.status(404).json({ error: "not_found" });
      return res.status(200).json({ state });
    } catch (error) {
      console.error("GET /api/longevity/body-plan-state-v2 failed", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    const parsed = normalizeState(req.body);
    if (!parsed) return res.status(400).json({ error: "Invalid payload" });

    try {
      await docRef(auth.uid).set(
        {
          activeBodyPlan: parsed.activeBodyPlan,
          clientUpdatedAt: parsed.updatedAt,
          serverSavedAt: admin.firestore.FieldValue.serverTimestamp(),
          version: "v2",
        },
        { merge: true }
      );
      return res.status(200).json({ state: parsed });
    } catch (error) {
      console.error("POST /api/longevity/body-plan-state-v2 failed", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
