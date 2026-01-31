import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ---------- helpers ---------- */

const dailyNutritionRules = `
DAILY NUTRITION GOALS — FRONTEND CONTRACT (DO NOT VIOLATE)

You MUST calculate DAILY nutrition goals exactly as defined below.
These rules are the single source of truth and MUST match the frontend.

DO NOT modify, optimize, rebalance, or personalize beyond these rules.

MACROS:
- Protein (g) = bodyweight_kg × 2.0
- Carbohydrates (g) = (targetCalories × 0.5) ÷ 4
- Fat (g) = (targetCalories × 0.3) ÷ 9
- Calories = targetCalories (unchanged)
- All macro values MUST be rounded to whole numbers (same as frontend Math.round).

MICRONUTRIENTS:
- Vitamin A (µg): male 900, female 700
- Vitamin C (mg): male 90, female 75
- Vitamin D (µg): 15
- Vitamin E (mg): 15
- Vitamin K (µg): male 120, female 90
- Vitamin B12 (µg): 2.4
- Iron (mg): male 8, female 18
- Calcium (mg): age > 50 → 1200, else 1000
- Magnesium (mg): male 420, female 320
- Zinc (mg): male 11, female 8
- Fiber (g): male 38, female 25
- Water (ml): male 3700, female 2700
- Sodium (mg): 2300
- Potassium (mg): 3500
- Chloride (mg): 2300

If your output does not match these formulas, you MUST recalculate before responding.
`;


const languageInstruction = (lang?: string) => {
  if (!lang) return "";
  return `Respond in ${lang}. If the user writes in another language, respond in the user's language instead.`;
};

const profileInstruction = (profile?: any) => {
  if (!profile) return "";

  const { height, weight, gender, goal } = profile;

  return `
User profile (use ONLY if relevant, never mention storage):
- Height: ${height ?? "unknown"} cm
- Weight: ${weight ?? "unknown"} kg
- Gender: ${gender ?? "unknown"}
- Goal: ${goal ?? "unknown"}

Rules:
- Use this info only for calorie targets, macros, meal plans, or fitness advice.
- If something is missing or "unknown", ask the user (only when required).
- Never assume values.
`;
};

const detectMealPlanIntent = (text?: string) => {
  if (!text || typeof text !== "string") return false;
  return /meal plan|diet plan|what should i eat|cut plan|bulk plan|macro plan|program|plan|برنامه غذایی|رژیم|چی بخورم|برام برنامه غذایی|غذا چی بخورم|کاهش وزن|افزایش وزن|کات|بالک/i.test(
    text
  );
};

const getAskedPreferenceFields = (history?: any[]): Set<string> => {
  const asked = new Set<string>();
  if (!history || !Array.isArray(history)) return asked;

  const assistantText = history
    .filter((item) => item?.role === "assistant")
    .map((item) => String(item?.content ?? "").toLowerCase())
    .join(" ");

  if (!assistantText) return asked;

  if (assistantText.includes("allerg")) asked.add("allergies");
  if (
    assistantText.includes("eating mode") ||
    assistantText.includes("diet") ||
    assistantText.includes("omnivore") ||
    assistantText.includes("vegetarian") ||
    assistantText.includes("vegan")
  ) {
    asked.add("eating_mode");
  }
  if (assistantText.includes("cooking style") || assistantText.includes("cook")) {
    asked.add("cooking_style");
  }
  if (assistantText.includes("protein") && assistantText.includes("gap")) {
    asked.add("protein_gap");
  }
  if (
    assistantText.includes("cultural") ||
    assistantText.includes("cuisine") ||
    assistantText.includes("middle eastern") ||
    assistantText.includes("mediterranean") ||
    assistantText.includes("asian")
  ) {
    asked.add("cultural_foods");
  }

  return asked;
};

const getAssistantQuestionCount = (history?: any[]) => {
  if (!history || !Array.isArray(history)) return 0;
  return history.filter((item) => {
    if (item?.role !== "assistant") return false;
    const text = String(item?.content ?? "");
    return text.includes("?") || text.includes("؟");
  }).length;
};

const getAllergyQuestionCount = (history?: any[]) => {
  if (!history || !Array.isArray(history)) return 0;
  const allergyMatchers = [
    "allerg",
    "alerg",
    "allergie",
    "alerji",
    "过敏",
    "アレルギ",
    "알레르기",
    "حساسیت",
  ];
  return history.filter((item) => {
    if (item?.role !== "assistant") return false;
    const text = String(item?.content ?? "").toLowerCase();
    const hasQuestion = text.includes("?") || text.includes("؟");
    if (!hasQuestion) return false;
    return allergyMatchers.some((word) => text.includes(word));
  }).length;
};

const isReasonableTarget = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

const getTargetsInstruction = (targets?: any) => {
  const calories = Number(targets?.calories);
  const protein = Number(targets?.protein);
  const carbs = Number(targets?.carbs);
  const fat = Number(targets?.fat);

  const valid =
    isReasonableTarget(calories, 100, 10000) &&
    isReasonableTarget(protein, 1, 500) &&
    isReasonableTarget(carbs, 1, 1000) &&
    isReasonableTarget(fat, 1, 300);

  if (!valid) return null;

  return `
Use these exact daily nutrition targets as the single source of truth.
Do NOT recalculate or modify them.

Daily targets:

Calories: ${Math.round(calories)}

Protein: ${Math.round(protein)} g

Carbs: ${Math.round(carbs)} g

Fat: ${Math.round(fat)} g

Generate breakfast, lunch, and dinner so that their totals are approximately equal to these values.
Return all numbers as integers.
`;
};

const extractJsonFromText = (text: string): any | null => {
  if (!text) return null;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {}
  }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {}
  }
  return null;
};

/* ---------- handler ---------- */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const {
      message,
      history,
      language,
      appLanguage,
      userAge,
      isPhoto,
      photoSafetyData,
      userAllergies,
      userProfile,
      userPreferences,
      previousMealPlan,
      profile,
      preferences,
      previousPlan,
      mode,
      targets,
    } = req.body || {};

    if (!message && !isPhoto) {
      return res.status(400).json({ error: "No message provided." });
    }

    const isMealPlanMode = mode === "meal_plan";
    const todayISO = new Date().toISOString().slice(0, 10);
    const effectiveLanguage = language ?? appLanguage;
    const effectiveUserProfile = userProfile ?? profile;
    const effectiveUserPreferences = userPreferences ?? preferences;
    const effectivePreviousMealPlan = previousMealPlan ?? previousPlan;
    console.log("🧪 AI meal_plan mode:", isMealPlanMode);
    console.log("🧪 AI prefs keys:", Object.keys(effectiveUserPreferences ?? {}));
    console.log("🧪 AI prev plan provided:", !!effectivePreviousMealPlan);
    console.log("🧪 AI targets provided:", !!targets);

    const combinedAllergies =
      typeof userAllergies === "string" && userAllergies.trim()
        ? userAllergies.trim()
        : effectiveUserPreferences?.allergies ?? "";

    const requiredPreferenceFields = [
      "allergies",
      "eating_mode",
      "cooking_style",
      "cultural_foods",
    ];
    const missingPreferences = requiredPreferenceFields.filter((field) => {
      if (field === "allergies") return !combinedAllergies;
      return (
        effectiveUserPreferences?.[field] === undefined ||
        effectiveUserPreferences?.[field] === null ||
        effectiveUserPreferences?.[field] === ""
      );
    });
    const askedFields = getAskedPreferenceFields(history);
    const totalQuestionCount = getAssistantQuestionCount(history);
    const allergyQuestionCount = getAllergyQuestionCount(history);
    const nonAllergyQuestionCount = Math.max(
      0,
      totalQuestionCount - allergyQuestionCount
    );
    const allowNonAllergyQuestions = nonAllergyQuestionCount < 5;
    const missingPreferencesFiltered = missingPreferences.filter((field) => {
      if (field === "allergies") return true;
      if (!allowNonAllergyQuestions) return false;
      return !askedFields.has(field);
    });
    const hasAllergiesAnswer = Boolean(combinedAllergies);
    const shouldForcePlan =
      isMealPlanMode &&
      (missingPreferencesFiltered.length === 0 || !allowNonAllergyQuestions) &&
      hasAllergiesAnswer;
    console.log("🧪 AI missing prefs:", missingPreferences);
    console.log("🧪 AI missing prefs (not asked):", missingPreferencesFiltered);
    console.log("🧪 AI question counts:", {
      totalQuestionCount,
      nonAllergyQuestionCount,
      allergyQuestionCount,
      allowNonAllergyQuestions,
    });

    const targetsInstruction = isMealPlanMode ? getTargetsInstruction(targets) : null;
    const nutritionInstruction = targetsInstruction ?? dailyNutritionRules;

    const systemPrompt = isMealPlanMode
      ? `
You are FitMacro Meal Plan Coach — a calm, practical daily meal plan assistant.

${languageInstruction(effectiveLanguage)}
${profileInstruction(effectiveUserProfile)}

MODE: meal_plan (STRICT)
Today is ${todayISO}.

You MUST use:
- saved user preferences
- previous day's meal plan (if provided)
- today's date

DAILY ASSISTANT BEHAVIOR
- Ask clarifying questions every day, but keep them small and incremental (prefer 1 short question).
- NEVER repeat full onboarding unless preferences are missing.
- If preferences are missing, ask to collect them first.

PREFERENCES (do not invent)
Saved preferences (may be empty): ${JSON.stringify(userPreferences ?? {})}
User allergies (may be empty): ${combinedAllergies || "none provided"}

PREVIOUS PLAN (if any)
${effectivePreviousMealPlan ? `Previous meal plan: ${JSON.stringify(effectivePreviousMealPlan)}` : "No previous meal plan provided."}

If a previous plan exists:
- Reference it.
- Ask if the user wants something similar or different.
- Ask about daily changes (training day, eating out, calories).

OUTPUT RULES (NON-NEGOTIABLE)
You must return ONLY one of two outputs:
A) A clarifying question in plain text (no JSON).
B) A FINAL meal plan in STRICT JSON format (no extra text).

MEAL PLAN JSON SHAPE
{
  "type": "meal_plan",
  "date": "YYYY-MM-DD",
  "entries": [
    {
      "id": string,
      "time": "HH:MM",
      "title": "Breakfast" | "Lunch" | "Dinner" | "Snack",
      "items": [
        {
          "name": string,
          "amount": string,
          "calories": number,
          "protein": number,
          "carbs": number,
          "fat": number
        }
      ]
    }
  ],
  "total": { "calories": number, "protein": number, "carbs": number, "fat": number },
  "updatedPreferences": optional object
}

MEAL PLAN RULES
- Include 3 main meals and 1–2 snacks.
- Provide realistic daily times (e.g. 08:00, 11:00, 14:00, 17:00, 20:00).
- Items must include concrete amounts like "150 g chicken breast".
- Sum of all items across all entries must approximately match total.

All numbers MUST be numbers (not strings).
Calories and macros must be realistic.
Meals must respect allergies and cultural foods.
Never give medical advice.
Never hallucinate allergies.
Never invent preferences.
Never output explanations with the meal plan.

If the user changes preferences in chat and you are returning JSON, include "updatedPreferences" with the new values.
If you must ask a clarifying question first, do NOT include JSON.

Missing preference fields: ${missingPreferences.join(", ") || "none"}.
Missing preference fields (not asked yet): ${missingPreferencesFiltered.join(", ") || "none"}.
Already asked non-allergy questions: ${nonAllergyQuestionCount} (max 5).
Already asked total questions: ${totalQuestionCount} (max 6 including allergy).
Ask ONLY these questions (one at a time) and only once per user:
- Allergies / hard restrictions (safety-critical)
- Eating mode (omnivore / vegetarian / vegan)
- Cooking style / time (simple/quick vs. more involved)
- Eating context (home vs. eating out)
- Cultural cuisine preference
- Today's change (training day, travel, higher protein)

Allergies are the only field you may re-ask if unclear or missing. Be strict until allergy info is clear.
All other questions must be asked at most once; if unanswered or unclear, do NOT ask again and proceed with a best-effort plan.
You MUST NOT ask more than 5 non-allergy questions total. After that, stop asking and output the meal plan.
You MUST NOT ask more than 6 total questions. If you already asked 6, output the meal plan (unless allergies are still missing).
If allergies are clear and you already asked the optional questions (or choose not to), generate the meal plan without further questions.
If targets or profile data are provided, use them to produce the best possible plan even if some optional answers are missing.
If missing preference fields (not asked yet) is "none" and allergies are clear, you MUST output the FINAL meal plan JSON now and MUST NOT ask more questions.
`
      : `
You are FitMacro Coach — a friendly, practical fitness & nutrition assistant.

${languageInstruction(effectiveLanguage)}
${profileInstruction(userProfile)}

🔒 DOMAIN LOCK
You may ONLY talk about:
- fitness
- workouts
- cardio
- recovery
- nutrition
- macros
- calories
- fat loss
- muscle gain
- hydration
- general food ideas

If the user asks about anything else:
Respond exactly:
"I can only help with fitness & nutrition 🙂 Let’s focus on your goals!"

👋 GREETINGS & GOODBYES
- If the user greets (hi/hello/salam/سلام), reply politely and briefly, then help.
- If the user says goodbye (bye/خداحافظ), reply politely and end the reply.
- Do NOT ignore greetings or goodbyes.

🙂 EMOJI RULES
- Use at most ONE emoji per message.
- Allowed emojis only: 🙂 💪 📊 🍽️
- NEVER use romantic/emotional emojis (❤️ 😍 😘 🥰 💕).
- Keep tone friendly but professional.

🧠 PROFESSIONAL BOUNDARY
- You are a fitness & nutrition coach, not a companion.
- Do NOT express affection, attachment, or romantic tone.
- Do NOT encourage emotional bonding. Keep it factual and goal-focused.

🍽️ MEAL PLAN MODE (IMPORTANT)
If the user asks for a meal plan, respond briefly that meal plans are handled in meal_plan mode and ask the user to switch modes.


😄 RESPONSE LENGTH
- For normal questions: 1–3 short sentences, clear and direct.
- For meal plans or calculations: structured and detailed as needed.

⚠️ ALLERGY SAFETY
- userAllergies may be provided (e.g. "nuts, dairy")
- Avoid these completely
- Briefly acknowledge once per suggestion
- Always remind the user to double-check ingredients for allergeies 

👶 AGE RULES
If userAge < 18:
- No supplements
- No extreme cutting
- No advanced programs
- Safe, basic advice only

📷 PHOTO RULES
If userAge < 18 and isPhoto == true:
Reply exactly:
"Photo analysis is only for users 18+ 🙂"

If isPhoto == true:
- Only neutral fitness progress
- No guessing identity
- No sexualized content
- If unsafe photo:
"I can only analyze regular, clothed fitness progress photos 🙂"

GENERAL:
- Never store data
- Never say “I remember”
- Never mention databases or storage
- Ask for missing info only when required
`;

   const messages: any[] = [
  { role: "system", content: systemPrompt },
  { role: "system", content: nutritionInstruction },
];
    if (shouldForcePlan) {
      messages.push({
        role: "system",
        content:
          "All required questions are answered. Do NOT ask any more questions. Output the FINAL meal plan JSON now.",
      });
    }


    if (!isMealPlanMode) {
      const isMealPlanIntent = detectMealPlanIntent(message);
      if (isMealPlanIntent) {
        messages.push({
          role: "system",
          content:
            "User is asking for a meal plan. Respond briefly that meal plans are only available in meal_plan mode and ask them to switch modes.",
        });
      }
    }

    if (
      combinedAllergies &&
      typeof combinedAllergies === "string" &&
      combinedAllergies.trim()
    ) {
      messages.push({
        role: "system",
        content: `User allergies: ${combinedAllergies}. Avoid these foods and remind the user to double-check ingredients.`,
      });
    }

    if (history && Array.isArray(history)) {
      messages.push(...history);
    }

    if (isPhoto) {
      messages.push({
        role: "user",
        content: `User uploaded a fitness photo. Safety data: ${JSON.stringify(
          photoSafetyData
        )}`,
      });
    } else {
      messages.push({ role: "user", content: message });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.6,
    });

    const rawContent = completion.choices[0].message.content ?? "";
    const parsed = extractJsonFromText(rawContent);
    if (parsed && typeof parsed === "object") {
      return res.status(200).json(parsed);
    }
    return res.status(200).json({
      reply: rawContent,
    });
  } catch (error) {
    console.error("AI Assistant Error:", error);
    return res.status(500).json({ error: "AI Assistant failed." });
  }
}
