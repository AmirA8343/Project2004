// pizza.ts

import { extractJson, languageInstruction, safeNum } from "./helpers";

type PizzaResult = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ai_summary: string;
  ai_foods: { name: string; weight_g: number | null; confidence: number }[];
};

export async function runPizzaScript(
  apiKey: string,
  photoUrl?: string,
  description?: string,
  language: string = "en"
): Promise<PizzaResult> {
  const prompt = `
You are a pizza nutrition expert.
${languageInstruction(language)}

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
      Authorization: `Bearer ${apiKey}`,
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
