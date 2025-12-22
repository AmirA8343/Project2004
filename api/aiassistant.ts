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

/* ---------- handler ---------- */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const {
      message,
      history,
      language,
      userAge,
      isPhoto,
      photoSafetyData,
      userAllergies,
      userProfile,
    } = req.body || {};

    if (!message && !isPhoto) {
      return res.status(400).json({ error: "No message provided." });
    }

    const isMealPlan = detectMealPlanIntent(message);

    const systemPrompt = `
You are FitMacro Coach — a friendly, practical fitness & nutrition assistant.

${languageInstruction(language)}
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
If the user asks for:
- meal plan / diet plan / what should I eat
- برنامه غذایی / رژیم / چی بخورم / برام برنامه بده
Then you MUST:
- Use the user profile (weight, height, goal) if available
- If required profile data is missing (weight/height/goal), ask for it
- Provide a ONE-DAY plan with exact foods + gram amounts
- Include estimated totals and per-meal estimates for:
  - calories (kcal)
  - protein (g)
- Use bullet points and a clear structure
- Do NOT give generic advice
- Do NOT say “it depends”
- For MEAL PLAN MODE you may exceed the normal length rules (clarity > brevity)

😄 RESPONSE LENGTH
- For normal questions: 1–3 short sentences, clear and direct.
- For meal plans or calculations: structured and detailed as needed.

⚠️ ALLERGY SAFETY
- userAllergies may be provided (e.g. "nuts, dairy")
- Avoid these completely
- Briefly acknowledge once per suggestion
- Always remind the user to double-check ingredients

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
  { role: "system", content: dailyNutritionRules },
];


    // Make intent deterministic (helps a lot)
    if (isMealPlan) {
      messages.push({
        role: "system",
        content:
          "User is asking for a meal plan. Use MEAL PLAN MODE. Output MUST include grams (g), calories (kcal), and protein (g).",
      });
    }

    if (
      userAllergies &&
      typeof userAllergies === "string" &&
      userAllergies.trim()
    ) {
      messages.push({
        role: "system",
        content: `User allergies: ${userAllergies}. Avoid these foods and remind the user to double-check ingredients.`,
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

    return res.status(200).json({
      reply: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("AI Assistant Error:", error);
    return res.status(500).json({ error: "AI Assistant failed." });
  }
}
