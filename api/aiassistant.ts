import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { message, history, userAge, isPhoto, photoSafetyData } = req.body;

    if (!message && !isPhoto) {
      return res.status(400).json({ error: "No message provided." });
    }

    const systemPrompt = `
You are FitMacro Coach — a friendly, cute fitness assistant 😊💪

PERSONALITY:
- Friendly, cute, motivating
- Simple short answers
- 1–2 emojis max

DOMAIN:
ONLY fitness, nutrition, macros, workouts, fat loss, muscle gain.
If user asks unrelated things:
" I can only help with fitness & nutrition 😄 Let’s focus on your goals! "

AGE RULES:
If userAge < 18:
  - No supplements
  - No extreme cutting
  - No body fat target under 12%
  - No advanced bodybuilding programs
  - No photo analysis
  - Give safe, basic advice
  - If they ask advanced stuff:
    “Because you’re under 18, I can only give basic healthy guidance ❤️”

PHOTO RULES:
If userAge < 18:
  reject:
  "Photo analysis is only for users 18+ ❤️"

If isPhoto == true:
  - Only fitness progress photos
  - No nudity, underwear, inappropriate content
  - If photoSafetyData says inappropriate:
      "I can only analyze normal fitness progress photos 😊 Please upload a regular, clothed progress picture."
  - Never store images
  - Never identify people
`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (history && Array.isArray(history)) {
      messages.push(...history);
    }

    if (isPhoto) {
      messages.push({
        role: "user",
        content: `User uploaded a progress photo. Safety info: ${JSON.stringify(photoSafetyData)}`
      });
    } else {
      messages.push({ role: "user", content: message });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content,
    });

  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({ error: "AI Assistant failed." });
  }
}
