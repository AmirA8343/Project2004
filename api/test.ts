// Full code will be inserted now
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

  console.log("📤 [PIZZA] Request messages:", JSON.stringify(messages, null, 2));

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0 }),
  });

  const data = (await resp.json()) as any;
  console.log("📥 [PIZZA] Raw OpenAI response:", JSON.stringify(data, null, 2));

  const content: string = data.choices?.[0]?.message?.content ?? "";
  console.log("📄 [PIZZA] Content:", content);

  const parsed = extractJson(content);
  console.log("✅ [PIZZA] Parsed JSON:", parsed);

  if (!parsed) throw new Error("Pizza analysis failed");

  const totalCalories = safeNum(parsed.calories_per_slice * parsed.slices);
  const totalProtein = safeNum(parsed.protein_per_slice * parsed.slices);
  const totalCarbs = safeNum(parsed.carbs_per_slice * parsed.slices);
  const totalFat = safeNum(parsed.fat_per_slice * parsed.slices);

  console.log("🍕 Pizza Summary:", parsed.summary);
  console.log("🍕 Pizza totals:", {
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
  });

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
  console.log("📩 Incoming request:", {
    method: req.method,
    body: req.body,
  });

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { description = "", photoUrl } = req.body || {};
  console.log("📝 Description:", description);
  console.log("🖼 Photo URL:", photoUrl);

  /* ---------- Stage 0: classify meal before any analysis ---------- */
  const stage0Prompt = `You classify the meal into one of three categories:
- "branded": packaged or branded product (Muscle Milk, Premier Protein, Starbucks, etc.)
- "single_food": single ingredient with clear quantity ("2 eggs", "150g chicken", "1 banana")
- "mixed_meal": multiple ingredients or cooked with extras ("eggs with oil", "chicken and rice", etc.)

Return STRICT JSON ONLY:
{
  "kind": "branded" | "single_food" | "mixed_meal",
  "normalized_name": "string",
  "quantity_description": "string|null"
}`;

  console.log("📤 [STAGE0] Prompt:", stage0Prompt);

  const stage0Resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
     messages: [
  { role: "system", content: stage0Prompt },
  { role: "assistant", content: "Return ONLY valid JSON. No explanations. No text outside JSON. No markdown." },
  { role: "user", content: description || "(no description)" }
]

    })
  });

  const stage0Data = await stage0Resp.json() as any;
  console.log("📥 [STAGE0] Raw response:", JSON.stringify(stage0Data, null, 2));

  const stage0Content = stage0Data.choices?.[0]?.message?.content || "";
  console.log("📄 [STAGE0] Content:", stage0Content);

  const stage0 = extractJson(stage0Content) || { kind: "mixed_meal", normalized_name: description, quantity_description: description };
  console.log("✅ [STAGE0] Parsed classification:", stage0);

  /* ---------- Bypass Stage1 & Stage2 for branded or single ingredient foods ---------- */
  if (stage0.kind === "branded" || stage0.kind === "single_food") {
    console.log("🚀 [BYPASS] Activated for kind:", stage0.kind, "description:", description);

    const simplePrompt = `You return exact nutrition only.
Rules:
- Do NOT estimate weight
- Do NOT apply mixed meal rules
- Do NOT adjust calories/protein
- Use canonical values or label values if branded
- Multiply by quantity

Return strict JSON:
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
  "fiber": number,
  "ai_summary": "string",
  "ai_foods": [{ "name": "string", "weight_g": number|null, "confidence": number }]
}`;

    console.log("📤 [BYPASS] simplePrompt:", simplePrompt);

    const simpleResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0,
       messages: [
  { role: "system", content: simplePrompt },
  { role: "assistant", content: "Return ONLY valid JSON. No explanations. No text outside JSON. No markdown." },
  { role: "user", content: description }  // <<<< IMPORTANT
]

      })
    });

    const simpleData = await simpleResp.json() as any;
    console.log("📥 [BYPASS] Raw response:", JSON.stringify(simpleData, null, 2));

    const simpleRaw = simpleData.choices?.[0]?.message?.content || "";
    console.log("📄 [BYPASS] Content:", simpleRaw);

    const simpleParsed = extractJson(simpleRaw);
    console.log("✅ [BYPASS] Parsed JSON:", simpleParsed);

    if (!simpleParsed) {
      console.log("❌ [BYPASS] Failed to parse simple food JSON");
      return res.status(500).json({ error: "Failed to parse simple food JSON" });
    }

    const nutrition = buildCompleteNutrition(simpleParsed);
    console.log("📊 [BYPASS] Built nutrition:", nutrition);

    const displayName =
      stage0.quantity_description ||
      stage0.normalized_name ||
      description;

    const responseBody = {
      ...nutrition,
      ai_summary: simpleParsed.ai_summary || `Logged: ${displayName}`,
      ai_foods: simpleParsed.ai_foods || [
        { name: displayName, weight_g: null, confidence: 1 }
      ]
    };

    console.log("✅ [BYPASS] Final response:", responseBody);

    return res.status(200).json(responseBody);
  }

  if (!OPENAI_API_KEY)
    return res.status(500).json({ error: "Missing OpenAI key" });

  /* ---------- Stage 1: identify foods & weights (hybrid correction) ---------- */
  const stage1Prompt = `
You are an expert nutrition vision analyst.

Identify all visible foods and estimate their weights in grams.
Use visual reasoning and realistic densities.
Return STRICT JSON ONLY:

{
  "foods": [
    { "name": "string", "weight_g": number, "confidence": number }
  ],
  "summary": "short, human-readable description of the meal and portion size"
}
`;

  console.log("📤 [STAGE1] Prompt:", stage1Prompt);

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

  console.log("📤 [STAGE1] Messages:", JSON.stringify(stage1Msgs, null, 2));

  const stage1Resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o", messages: stage1Msgs, temperature: 0 }),
  });

  const stage1Data = (await stage1Resp.json()) as any;
  console.log("📥 [STAGE1] Raw response:", JSON.stringify(stage1Data, null, 2));

  const stage1Content: string = stage1Data.choices?.[0]?.message?.content ?? "";
  console.log("📄 [STAGE1] Content:", stage1Content);

  const stage1 = extractJson(stage1Content) ?? { foods: [], summary: "" };

  console.log("🍲 AI Meal Summary:", stage1.summary || "(none)");
  console.table(stage1.foods);
  console.log("✅ [STAGE1] Parsed JSON:", stage1);

  /* ---------- Pizza special case ---------- */
  const combinedText =
    (
      description +
      " " +
      (stage1.summary || "") +
      " " +
      (stage1.foods || []).map((f: any) => f.name).join(" ")
    ).toLowerCase();

  console.log("🔍 [PIZZA CHECK] combinedText:", combinedText);

  if (combinedText.includes("pizza")) {
    console.log("🍕 [PIZZA] Detected pizza, running pizza script...");
    try {
      const pizzaResult = await runPizzaScript(photoUrl, description);
      console.log("✅ [PIZZA] Result:", pizzaResult);
      return res.status(200).json(pizzaResult);
    } catch (err) {
      console.log("❌ [PIZZA] Pizza script failed:", err);
    }
  }

  /* ---------- Stage 2: compute nutrition ---------- */
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

  console.log("📋 [STAGE2] foodList:", foodList);
  console.log("⚖️ [STAGE2] totalWeight:", totalWeight);

  const stage2Prompt = `
Estimate TOTAL nutrition for:
${foodList}
Estimated total weight: ${totalWeight} g

Return STRICT JSON ONLY with:

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

  console.log("📤 [STAGE2] Prompt:", stage2Prompt);

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
  console.log("📥 [STAGE2] Raw response:", JSON.stringify(stage2Data, null, 2));

  const stage2Content: string = stage2Data.choices?.[0]?.message?.content ?? "";
  console.log("📄 [STAGE2] Content:", stage2Content);

  const parsed = extractJson(stage2Content);
  console.log("✅ [STAGE2] Parsed JSON:", parsed);

  if (!parsed)
    return res.status(500).json({ error: "Failed to parse nutrition JSON" });

  const nutrition = buildCompleteNutrition(parsed);
  console.log("📊 [STAGE2] Built nutrition:", nutrition);

  /* ---------- Stage 3: humanize summary ---------- */
  let friendlySummary = stage1.summary || "";
  console.log("📝 [STAGE3] Original summary:", friendlySummary);

  if (friendlySummary) {
    const tonePrompt = `
Rewrite the following meal description in a clean, professional, human tone.

Guidelines:
- Remove robotic language such as "the image shows" or "likely part of"
- Use natural, concise wording (1–2 short sentences)
- If uncertain, use soft wording like "appears to be" or "looks like"
- Do NOT mention cameras, photos, AI, or analysis
- No emojis, no marketing language
Return ONLY the rewritten text.

Original:
"${friendlySummary}"
`;

    console.log("📤 [STAGE3] Tone prompt:", tonePrompt);

    try {
      const toneResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: tonePrompt }],
          temperature: 0.3,
        }),
      });

      const toneData = await toneResp.json() as any;
      console.log("📥 [STAGE3] Raw tone response:", JSON.stringify(toneData, null, 2));

      const newText = toneData.choices?.[0]?.message?.content?.trim();
      console.log("📄 [STAGE3] Tone content:", newText);

      if (newText) friendlySummary = newText;
    } catch (err) {
      console.log("⚠️ [STAGE3] Tone rewrite failed, returning original summary.", err);
    }
  }

  const finalResponse = {
    ...nutrition,
    ai_summary: friendlySummary,
    ai_foods: stage1.foods || [],
  };

  console.log("✅ [FINAL] Response body:", finalResponse);

  return res.status(200).json(finalResponse);
}
