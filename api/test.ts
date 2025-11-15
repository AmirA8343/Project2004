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
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const raw = text.match(/\{[\s\S]*\}/);
  if (raw) {
    try {
      return JSON.parse(raw[0]);
    } catch {}
  }
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

Return STRICT JSON only:

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

  const data = (await resp.json()) as any;
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);

  if (!parsed) throw new Error("Pizza analysis failed");

  const totalCalories = safeNum(parsed.calories_per_slice * parsed.slices);
  const totalProtein = safeNum(parsed.protein_per_slice * parsed.slices);
  const totalCarbs = safeNum(parsed.carbs_per_slice * parsed.slices);
  const totalFat = safeNum(parsed.fat_per_slice * parsed.slices);

  console.log("🍕 Pizza Summary:", parsed.summary);
  return {
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    ai_summary: parsed.summary,
    ai_foods: [
      {
        name: parsed.type,
        weight_g: parsed.weight_per_slice_g * parsed.slices,
        confidence: 0.9,
      },
    ],
  };
}

/* ---------- main handler ---------- */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { description = "", photoUrl } = req.body || {};
  if (!OPENAI_API_KEY)
    return res.status(500).json({ error: "Missing OpenAI key" });

  /* ---------- Stage 1: identify foods & weights (hybrid correction) ---------- */
  const stage1Prompt = `
You are an expert nutrition vision analyst.

Your tasks:
1. Identify every visible edible item in the meal.
2. Estimate each item's weight in grams.
3. Use all available visual cues to estimate real-world size:
   - Use reference objects when visible: hand, fingers, fork, spoon, knife, chopsticks, plate, bowl, cup, bottle, known packaging.
   - Assume common real-world dimensions:
     • dinner plate: 26–28 cm diameter
     • small plate: 20–22 cm
     • fork/spoon: 16–20 cm
     • mug: 8–10 cm tall
   - Infer approximate camera distance from:
     • field of view (how much of the table is visible)
     • distortion and perspective
     • how large objects appear in the frame.
4. Apply hybrid portion correction:
   - If reference objects and geometry are clear (high confidence), apply mild correction (about ±10–20%) to refine weights.
   - If the meal is large or the camera is far / angled and portion size might be underestimated, allow stronger correction (about +30–60%) where appropriate.
   - Apply corrections per item when needed (e.g., a big bowl of rice vs a small sauce cup).
5. Do NOT artificially limit total meal weight. Large meals can exceed 800–1200g.
6. Use realistic densities:
   - cooked rice/pasta: ~130–170 g per cup
   - cooked meat: ~120–180 g per piece (chicken breast, steak)
   - cheese: ~25–30 g per slice or small handful
   - liquids and soups: volume roughly matches the container.

Return STRICT JSON ONLY with this schema:

{
  "foods": [
    { "name": "string", "weight_g": number, "confidence": number }
  ],
  "summary": "short, human-readable description of the meal and portion size"
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

  const stage1Data = (await stage1Resp.json()) as any;
  const stage1Content: string = stage1Data.choices?.[0]?.message?.content ?? "";
  const stage1 = extractJson(stage1Content) ?? { foods: [], summary: "" };

  console.log("🍲 AI Meal Summary:", stage1.summary || "(none)");
  console.table(stage1.foods);

  /* ---------- Pizza special case ---------- */
  const combinedText =
    (
      description +
      " " +
      (stage1.summary || "") +
      " " +
      (stage1.foods || []).map((f: any) => f.name).join(" ")
    ).toLowerCase();

  if (combinedText.includes("pizza")) {
    try {
      const pizzaResult = await runPizzaScript(photoUrl, description);
      return res.status(200).json(pizzaResult);
    } catch (err) {
      console.error("❌ Pizza script failed:", err);
      // fallback to normal nutrition estimation below
    }
  }

  /* ---------- Stage 2: compute nutrition normally (no kcal cap) ---------- */
  const foodList =
    (stage1.foods && stage1.foods.length
      ? stage1.foods
          .map((f: any) => `${safeNum(f.weight_g)}g ${f.name}`)
          .join(", ")
      : description) || "(no foods detected)";

  const totalWeight =
    stage1.foods?.reduce(
      (sum: number, f: any) => sum + (Number(f.weight_g) || 0),
      0
    ) || 0;

  const stage2Prompt = `
You are an expert dietitian.

Estimate the TOTAL nutrition for this meal based on the foods and weights:
Foods: ${foodList}
Estimated total meal weight: ${totalWeight} g

Use realistic serving-based calculations and standard food databases (e.g., USDA averages).

Important rules:
- Large meals can easily exceed 1000–2000 kcal depending on ingredients (e.g., pizza, fast food, large rice/meat plates).
- Do NOT artificially cap or limit calories; follow the weights and typical energy density of each food.
- If a micronutrient is genuinely unknown, use 0 rather than inventing a random number.

Return STRICT JSON ONLY with a single object:

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
`;

  const stage2Resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
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
    return res.status(200).json({
      ...nutrition,
      ai_summary: stage1.summary || "",
      ai_foods: stage1.foods || [],
    });
  }

  return res.status(500).json({ error: "Failed to parse nutrition JSON" });
}
