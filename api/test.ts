import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

/* ---------- helpers ---------- */
const safeNum = (v: any) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const buildCompleteNutrition = (d: any = {}) => ({
  protein: safeNum(d.protein),
  calories: safeNum(d.calories),
  carbs: safeNum(d.carbs ?? d.carbohydrates),
  fat: safeNum(d.fat),

  vitaminA: safeNum(d.vitaminA),
  vitaminC: safeNum(d.vitaminC),
  vitaminD: safeNum(d.vitaminD),
  vitaminE: safeNum(d.vitaminE),
  vitaminK: safeNum(d.vitaminK),
  vitaminB12: safeNum(d.vitaminB12),
  iron: safeNum(d.iron),
  calcium: safeNum(d.calcium),
  magnesium: safeNum(d.magnesium),
  zinc: safeNum(d.zinc),

  water: safeNum(d.water),
  sodium: safeNum(d.sodium),
  potassium: safeNum(d.potassium),
  chloride: safeNum(d.chloride),
  fiber: safeNum(d.fiber),
});

const extractJson = (text: string) => {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence?.[1]) try { return JSON.parse(fence[1]); } catch {}
  const raw = text.match(/\{[\s\S]*\}/);
  if (raw) try { return JSON.parse(raw[0]); } catch {}
  return null;
};

/* ---------- main handler ---------- */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { description = "", photoUrl } = req.body || {};
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "Missing OpenAI key" });

  /* ---------- Stage 1: identify foods & weights ---------- */
  const stage1Prompt = `
You are an expert nutrition vision analyst.
1️⃣ Identify every visible edible item in the meal.
2️⃣ Estimate each item's weight (grams) and note any hidden ingredients like oil or sauce.
3️⃣ Use realistic portion sizes (total meal < 600g unless clearly large).
Return STRICT JSON:

{
  "foods": [
    {"name": "string", "weight_g": number, "confidence": 0.0-1.0}
  ],
  "summary": "short, human-readable description of what the bowl contains"
}

Example:
{
  "foods": [
    {"name": "grilled chicken breast", "weight_g": 130, "confidence": 0.95},
    {"name": "white rice", "weight_g": 150, "confidence": 0.9},
    {"name": "olive oil (cooking)", "weight_g": 5, "confidence": 0.7}
  ],
  "summary": "A bowl with about 150g white rice, 120g grilled chicken breast, and 5g oil used in cooking."
}
`;

  const stage1Msgs: any[] = [
    { role: "system", content: stage1Prompt },
    { role: "user", content: description || "(no description)" },
  ];
  if (photoUrl) {
    stage1Msgs.push({
      role: "user",
      content: [
        { type: "text", text: "Analyze this image as part of the meal." },
        { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
      ],
    });
  }

  const stage1Resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o", messages: stage1Msgs, temperature: 0 }),
  });

  const stage1Data = await stage1Resp.json() as any;
  const stage1Content: string = stage1Data.choices?.[0]?.message?.content ?? "";
  const stage1 = extractJson(stage1Content) ?? { foods: [], summary: "" };

  // Log the AI's bowl interpretation in server logs
  console.log("🍲 AI Bowl Summary:", stage1.summary || "(none)");
  console.table(stage1.foods);

  /* ---------- Stage 2: compute nutrition ---------- */
  const foodList =
    stage1.foods?.map((f: any) => `${f.weight_g || ""}g ${f.name}`).join(", ") ||
    description;

  const stage2Prompt = `
You are an expert dietitian. Estimate total nutrition for: ${foodList}.
Use realistic serving-based calculations and standard food databases (e.g., USDA averages).
Output ONLY one JSON object with numeric integer values:

{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "vitaminA": number,
  "vitaminC": number,
  "vitaminD": number,
  "vitaminE": number,
  "vitaminK": number,
  "vitaminB12": number,
  "iron": number,
  "calcium": number,
  "magnesium": number,
  "zinc": number,
  "water": number,
  "sodium": number,
  "potassium": number,
  "chloride": number,
  "fiber": number
}

Sanity rules:
- Never exceed 1200 kcal unless total weight > 500g.
- Use 0 if unknown.
- Respond with JSON only.
`;

  const stage2Resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: stage2Prompt }],
      temperature: 0,
      max_tokens: 800,
    }),
  });

 const stage2Data = (await stage2Resp.json()) as any;
  const stage2Content: string = stage2Data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(stage2Content);

  if (parsed) {
    const nutrition = buildCompleteNutrition(parsed);
    // Include AI summary in response for debugging or user info
    return res.status(200).json({
      ...nutrition,
      ai_summary: stage1.summary || "",
      ai_foods: stage1.foods || [],
    });
  }

  return res.status(500).json({ error: "Failed to parse nutrition JSON" });
}
