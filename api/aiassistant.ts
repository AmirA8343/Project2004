import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ---------- helpers ---------- */
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
- If something is missing or "unknown", ask the user.
- Never assume values.
`;
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
      userProfile, // ✅ NEW
    } = req.body || {};

    if (!message && !isPhoto) {
      return res.status(400).json({ error: "No message provided." });
    }

    const systemPrompt = `
You are FitMacro Coach — a friendly, concise fitness & nutrition assistant 💪

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
"I can only help with fitness & nutrition 😄 Let’s focus on your goals!"

😄 PERSONALITY
- Friendly, natural
- 1–3 short sentences
- Max 2 emojis
- You MAY greet and say goodbye naturally

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
"Photo analysis is only for users 18+ ❤️"

If isPhoto == true:
- Only neutral fitness progress
- No guessing identity
- No sexualized content
- If unsafe photo:
"I can only analyze regular, clothed fitness progress photos 😊"

GENERAL:
- Never store data
- Never say “I remember”
- Never mention databases or storage
- Ask for missing info only when required
`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (userAllergies && typeof userAllergies === "string" && userAllergies.trim()) {
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
        content: `User uploaded a fitness photo. Safety data: ${JSON.stringify(photoSafetyData)}`,
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
