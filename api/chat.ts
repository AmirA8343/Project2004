import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

/* ---------- helpers ---------- */
const safeNum = (v: any) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const buildCompleteNutrition = (d: any = {}) => ({
  protein: safeNum(d.protein),
  calories: safeNum(d.calories),
  carbs: safeNum(d.carbs ?? d.carbohydrates),
  fat: safeNum(d.fat),
});

const extractJson = (text: string) => {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence?.[1]) try { return JSON.parse(fence[1]); } catch {}
  const raw = text.match(/\{[\s\S]*\}/);
  if (raw) try { return JSON.parse(raw[0]); } catch {}
  return null;
};

/* ---------- pizza-specific subroutine ---------- */
async function runPizzaScript(photoUrl?: string, description?: string) {
  const prompt = `
You are a pizza nutrition expert.
Analyze the given image and/or description to identify:
- number of slices visible
- pizza type (thin crust, regular, deep dish)
- main toppings (e.g., cheese, pepperoni, vegetables)
- approximate weight per slice in grams
Estimate per-slice nutrition (calories, protein, carbs, fat).

Return JSON only:
{
  "type": "string",
  "slices": number,
  "weight_per_slice_g": number,
  "calories_per_slice": number,
  "protein_per_slice": number,
  "carbs_per_slice": number,
  "fat_per_slice": number,
  "summary": "short description"
}
`;

  const messages: any[] = [{ role: "system", content: prompt }];
  if (description) messages.push({ role: "user", content: description });
  if (photoUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Analyze this pizza photo." },
        { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
      ],
    });
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0 }),
  });

  const data = await resp.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);

  if (!parsed) throw new Error("Pizza analysis failed");

  const totalCalories = safeNum(parsed.calories_per_slice * parsed.slices);
  const totalProtein = safeNum(parsed.protein_per_slice * parsed.slices);
  const totalCarbs = safeNum(parsed.carbs_per_slice * parsed.slices);
  const totalFat = safeNum(parsed.fat_per_slice * parsed.slices);

  return {
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    ai_summary: parsed.summary,
    ai_foods: [
      { name: parsed.type, weight_g: parsed.weight_per_slice_g * parsed.slices, confidence: 0.9 },
    ],
  };
}

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
  "foods": [{"name": "string", "weight_g": number, "confidence": 0.0-1.0}],
  "summary": "short, human-readable description"
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
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o", messages: stage1Msgs, temperature: 0 }),
  });

  const stage1Data = await stage1Resp.json();
  const stage1Content: string = stage1Data.choices?.[0]?.message?.content ?? "";
  const stage1 = extractJson(stage1Content) ?? { foods: [], summary: "" };

  console.log("🍲 Meal Summary:", stage1.summary || "(none)");
  console.table(stage1.foods);

  // Build readable ingredient list
  const ingredientSummary =
    stage1.foods && stage1.foods.length
      ? stage1.foods.map((f: any) => `${safeNum(f.weight_g)}g ${f.name}`).join(", ")
      : "";

  /* ---------- Pizza special case ---------- */
  const combinedText =
    (description + " " + stage1.summary + " " + stage1.foods.map((f: any) => f.name).join(" ")).toLowerCase();
  if (combinedText.includes("pizza")) {
    try {
      const pizzaResult = await runPizzaScript(photoUrl, description);
      return res.status(200).json({
        status: "success",
        meal_description: ingredientSummary || pizzaResult.ai_summary || "Meal analyzed",
        nutrition: {
          protein: pizzaResult.protein,
          calories: pizzaResult.calories,
          carbs: pizzaResult.carbs,
          fat: pizzaResult.fat,
        },
      });
    } catch (err) {
      console.error("❌ Pizza script failed:", err);
    }
  }

  /* ---------- Stage 2: compute nutrition normally ---------- */
  const foodList =
    stage1.foods?.map((f: any) => `${f.weight_g || ""}g ${f.name}`).join(", ") || description;

  const stage2Prompt = `
You are an expert dietitian. Estimate total nutrition for: ${foodList}.
Use realistic serving-based calculations and standard food databases (e.g., USDA averages).
Output ONLY one JSON object with numeric integer values for calories, protein, carbs, fat.
`;

  const stage2Resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: stage2Prompt }],
      temperature: 0,
      max_tokens: 500,
    }),
  });

  const stage2Data = await stage2Resp.json();
  const stage2Content: string = stage2Data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(stage2Content);

  if (parsed) {
    const nutrition = buildCompleteNutrition(parsed);
    return res.status(200).json({
      status: "success",
      meal_description: ingredientSummary || stage1.summary || "Meal analyzed",
      nutrition,
    });
  }

  return res.status(500).json({ error: "Failed to parse nutrition JSON" });
}
