import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


/* -------------------------------------------------------------------------- */
/*                                Type Helpers                                */
/* -------------------------------------------------------------------------- */
interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  categories_tags?: string[];
  nutriments?: Record<string, any>;
  generic_name?: string;
  labels_tags?: string[];
  quantity?: string;
  ingredients_text?: string;
}
interface OpenFoodFactsResponse {
  product?: OpenFoodFactsProduct;
}

function extractHumanUnit(servingSize?: string): string | null {
  if (!servingSize) return null;

  // examples:
  // "25 chips (50 g)"
  // "2 cookies (30 g)"
  // "1 bar (40 g)"

  const m = servingSize.match(/(\d+)\s*([a-zA-Z]+)/);
  if (!m) return null;

  const unit = m[2].toLowerCase();

  // filter out metric units
  if (["g", "gram", "grams", "ml", "l"].includes(unit)) return null;

  return unit;
}


interface OpenAIResponse {
  choices?: { message?: { content?: string } }[];
}

/* ---------------------------- Shared type alias ---------------------------- */
type ProductType = "liquid" | "solid" | "portion" | "unknown" | "non_food";

/* ----------------------------- helpers: numbers ---------------------------- */
function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function scalePerServing(valuePer100: any, servingSize: string | undefined) {
  const n = Number(valuePer100);
  if (!Number.isFinite(n) || !servingSize) return safeNum(valuePer100);
  const m = servingSize.match(/([\d.]+)\s*(ml|g)\b/i);
  if (!m) return safeNum(valuePer100);
  const amount = parseFloat(m[1]);
  if (!Number.isFinite(amount) || amount <= 0) return safeNum(valuePer100);
  return Math.round((n * amount) / 100);
}

/* -------------------------------------------------------------------------- */
/*                             🧠 EDIBILITY GUARD                             */
/* -------------------------------------------------------------------------- */

const BLOCK_COSMETIC = [
  "sunscreen","spf","sun screen","uv","broad spectrum","moisturizer","cleanser","serum",
  "retinol","niacinamide","hyaluronic","cream","lotion","ointment","balm","mask","peel",
  "exfoliant","skin","face","body","shampoo","conditioner","hair","deodorant","antiperspirant",
  "makeup","cosmetic","fragrance","parfum","perfume","aftershave","lipstick","lip balm"
];
const BLOCK_HOUSEHOLD = [
  "detergent","bleach","disinfectant","cleaner","dishwashing","laundry","fabric softener",
  "air freshener","insecticide","repellent","trash bag","aluminum foil","food wrap","zip bag"
];
const BLOCK_CONTAINER = [
  "refillable","reusable","stainless","plastic","metal","glass","flask","tumbler","thermos",
  "water bottle","sports bottle","mug","container","jar","lid"
];
const BLOCK_CHEMICAL = [
  "alcohol denat","benzene","sulfate","hydroxide","chloride","titanium dioxide",
  "zinc oxide","silicone","polyethylene","polypropyl","acrylate","copolymer"
];
const PET_NONFOOD = ["cat litter","dog shampoo","flea","tick collar"];

/* ✅ Expanded hints for foods, bars, powders, supplements */
const FOOD_HINTS = [
  "sugar","salt","wheat","rice","milk","cream","butter","egg","yeast","cocoa","chocolate",
  "vanilla","flour","soy","peanut","almond","hazelnut","olive","sunflower","garlic","onion",
  "tomato","apple","banana","strawberry","meat","fish","chicken","pasta","snack","chips",
  "protein","bar","snack bar","protein bar","energy bar","granola","cereal","bread","oats","builder"
];

const SUPPLEMENT_HINTS = [
  "powder","whey","casein","isolate","concentrate","mass gainer","gainer",
  "collagen","pea protein","soy protein","plant protein",
  "creatine","bcaa","branched chain amino acids","electrolyte","pre-workout","post-workout"
];

const BEVERAGE_HINTS = [
  "drink","juice","water","mineral water","spring water","sparkling","soda","cola",
  "energy drink","sports drink","tea","coffee","smoothie"
];

const FOOD_CATEGORY_TAG_HINTS = [
  "en:snacks","en:snack-bars","en:protein-bars","en:nutrition-bars",
  "en:protein-supplements","en:breakfast-cereals","en:beverages","en:meals"
];

function includesAny(s: string, arr: string[]) {
  const x = s.toLowerCase();
  return arr.some(w => x.includes(w));
}
function arrayIncludesAny(arr: string[] | undefined, needles: string[]) {
  if (!arr || arr.length === 0) return false;
  const lower = arr.map(x => x.toLowerCase());
  return needles.some(n => lower.some(tag => tag.includes(n)));
}
function plausibleNutrition(n: any): boolean {
  if (!n) return false;
  const vals = [
    Number(n["energy-kcal_100g"]),
    Number(n.proteins_100g),
    Number(n.carbohydrates_100g),
    Number(n.fat_100g)
  ].filter(Number.isFinite);
  return vals.some(v => v > 0);
}
function isReusableContainer(name: string, categories: string) {
  const hay = `${name} ${categories}`.toLowerCase();
  if (hay.includes("water bottle") || includesAny(hay, BLOCK_CONTAINER)) {
    if (!includesAny(hay, ["bottled water","spring water","mineral water","drinking water"])) {
      return true;
    }
  }
  return false;
}
function hasStrongFoodEvidence({
  hay, nutriments, categoriesTags, servingSize,
}: { hay: string; nutriments: any; categoriesTags?: string[]; servingSize?: string; }) {
  const hasBarRegex = /\b(protein|energy|nutrition|builder)\s*bar\b/.test(hay);
  const hasFoodWords =
    includesAny(hay, FOOD_HINTS) ||
    includesAny(hay, SUPPLEMENT_HINTS) ||
    includesAny(hay, BEVERAGE_HINTS) ||
    includesAny(hay, ["bar","snack","nutrition bar"]);
  const hasFoodCats = arrayIncludesAny(categoriesTags, FOOD_CATEGORY_TAG_HINTS);
  const hasUnits = !!servingSize?.match(/\b(\d+(\.\d+)?)\s*(g|ml)\b/i);
  const hasMacros = plausibleNutrition(nutriments);
  return hasBarRegex || hasFoodWords || hasFoodCats || hasUnits || hasMacros;
}

function guardEdible({
  name = "", brand = "", categories = "", categoriesTags = [],
  servingSize = "", nutriments = undefined,
}: {
  name?: string; brand?: string; categories?: string; categoriesTags?: string[];
  servingSize?: string; nutriments?: any;
}): { isEdible: boolean; reason: string } {
  const hay = [name, brand, categories, servingSize].join(" ").toLowerCase();
  if (includesAny(hay, PET_NONFOOD)) return { isEdible: false, reason: "pet product" };
  if (isReusableContainer(name, categories || "")) return { isEdible: false, reason: "reusable container" };

 const hasCosmetic = includesAny(hay, BLOCK_COSMETIC);
const hasHousehold = includesAny(hay, BLOCK_HOUSEHOLD);
const hasChemical = includesAny(hay, BLOCK_CHEMICAL);

// ✅ If clearly a protein/energy/nutrition bar, skip non-food rejection
const isClearlyBar =
  /\b(protein|energy|nutrition|builder)\s*bar\b/.test(hay) ||
  includesAny(hay, ["protein bar", "energy bar", "nutrition bar", "builder bar"]);

const strongFood = hasStrongFoodEvidence({ hay, nutriments, categoriesTags, servingSize });
if (!isClearlyBar && (hasCosmetic || hasHousehold || hasChemical) && !strongFood) {
  return { isEdible: false, reason: "cosmetic/chemical/household product" };
}

  let score = 0;
  if (/\b(protein|energy|nutrition|builder)\s*bar\b/.test(hay)) score += 3;
  if (includesAny(hay, SUPPLEMENT_HINTS)) score += 2;
  if (includesAny(hay, BEVERAGE_HINTS)) score += 2;
  if (includesAny(hay, FOOD_HINTS)) score += 2;
  if (plausibleNutrition(nutriments)) score += 3;
  if (arrayIncludesAny(categoriesTags, FOOD_CATEGORY_TAG_HINTS)) score += 3;
  if (includesAny(hay, ["bottled water","spring water","mineral water","drinking water"])) score += 3;
  if (hay.includes("oil") && includesAny(hay, ["skin","hair","body","face"])) score -= 3;
  if (/\bspf\s?\d{1,3}\b/.test(hay)) score -= 4;

  if (includesAny(hay, SUPPLEMENT_HINTS) && score >= 2)
    return { isEdible: true, reason: "supplement/powder evidence" };
  if ((/\b(bar|snack|nutrition)\b/.test(hay) || arrayIncludesAny(categoriesTags, ["en:snack-bars","en:protein-bars"])) && score >= 2)
    return { isEdible: true, reason: "bar/snack evidence" };
  if (score >= 3) return { isEdible: true, reason: "sufficient edible evidence" };
  return { isEdible: false, reason: "insufficient edible evidence" };
}

/* ------------------------------ helpers: output ----------------------------- */
function buildCompleteNutrition(data: any = {}) {
  return {
    name: data.name || "Unknown",
    brand: data.brand || "",
    source: data.source || "unknown",
    type: data.type || "unknown",
    servingSize: data.servingSize || "",
    baseAmount: safeNum(data.baseAmount),
    servingUnitHuman: data.servingUnitHuman || null,

    baseUnit:
      data.baseUnit === "ml" || data.baseUnit === "g" || data.baseUnit === "portion"
        ? data.baseUnit : "g",
    protein: safeNum(data.protein),
    calories: safeNum(data.calories),
    carbs: safeNum(data.carbs ?? data.carbohydrates),
    fat: safeNum(data.fat),
    vitaminA: safeNum(data.vitaminA),
    vitaminC: safeNum(data.vitaminC),
    vitaminD: safeNum(data.vitaminD),
    vitaminE: safeNum(data.vitaminE),
    vitaminK: safeNum(data.vitaminK),
    vitaminB12: safeNum(data.vitaminB12),
    iron: safeNum(data.iron),
    calcium: safeNum(data.calcium),
    magnesium: safeNum(data.magnesium),
    zinc: safeNum(data.zinc),
    water: safeNum(data.water),
    sodium: safeNum(data.sodium),
    potassium: safeNum(data.potassium),
    chloride: safeNum(data.chloride),
    fiber: safeNum(data.fiber),
    sugar: safeNum(data.sugar),
  };
}
function extractJsonFromText(text: string): any | null {
  if (!text) return null;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) try { return JSON.parse(fenceMatch[1]); } catch {}
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) try { return JSON.parse(objMatch[0]); } catch {}
  return null;
}

/* --------------------------------- handler -------------------------------- */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const barcode = (req.query.barcode || (req.body as any)?.barcode)?.toString();
  if (!barcode) return res.status(400).json({ error: "Missing barcode parameter" });

  try {
    /* ------------------------------- 1) OpenFoodFacts ------------------------------ */
    const offResp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    if (offResp.ok) {
      const offData = (await offResp.json()) as OpenFoodFactsResponse;
      const p = offData?.product;
      if (p) {
        const name = p.product_name || p.generic_name || "";
        const brand = p.brands || "";
        const servingRaw = p.serving_size || "";
        const categoriesTags = p.categories_tags || [];
        const categoriesText = categoriesTags.join(", ");
        const n = p.nutriments || {};
        const ingredients = p.ingredients_text || "";
        const labels = (p.labels_tags || []).join(", ");

        const extraContext = `${categoriesText} ${ingredients} ${labels}`;

        const guard = guardEdible({
          name,
          brand,
          categories: extraContext,
          categoriesTags,
          servingSize: servingRaw,
          nutriments: n
        });
        if (!guard.isEdible)
          return res.status(200).json({ error: "non_food", message: guard.reason });

        const caloriesPer100 = n["energy-kcal_100g"];
        const proteinPer100 = n.proteins_100g;
        const carbsPer100 = n.carbohydrates_100g;
        const fatPer100 = n.fat_100g;
        const fiberPer100 = n.fiber_100g;
        const sugarsPer100 = n.sugars_100g;
        const sodiumPer100Mg = Number.isFinite(n.sodium_100g)
          ? n.sodium_100g * 1000 : undefined;

        const servingSizeOut = servingRaw || "100 g";

        const humanUnit = extractHumanUnit(servingSizeOut);

// numeric part before human unit (e.g. 25 chips)
        const humanAmountMatch = servingSizeOut.match(/(\d+)\s*[a-zA-Z]+/);
        const humanAmount = humanAmountMatch ? safeNum(humanAmountMatch[1]) : null;

// grams/ml inside parentheses
        const metricMatch = servingSizeOut.match(/\((\d+)\s*(g|ml)\)/i);
        const metricAmount = metricMatch ? safeNum(metricMatch[1]) : null;
        const metricUnit = metricMatch?.[2]?.toLowerCase();

        const baseUnit = humanUnit ?? metricUnit ?? "g";
        const baseAmount = humanUnit ? humanAmount : metricAmount ?? 100;

        const shouldScale = baseUnit === "ml" || baseUnit === "g";

     const fromOpenFoodFacts = {
  name,
  brand,
  source: "OpenFoodFacts",
  type: baseUnit === "ml" ? "liquid" : "solid",

  servingSize: servingSizeOut,

  baseAmount,                 // 25
  baseUnit,                   // "chips"
  servingUnitHuman: humanUnit, // "chips"

  calories: scalePerServing(caloriesPer100, servingSizeOut),
  protein: scalePerServing(proteinPer100, servingSizeOut),
  carbs: scalePerServing(carbsPer100, servingSizeOut),
  fat: scalePerServing(fatPer100, servingSizeOut),
  fiber: scalePerServing(fiberPer100, servingSizeOut),
  sugar: scalePerServing(sugarsPer100, servingSizeOut),
  sodium: scalePerServing(sodiumPer100Mg, servingSizeOut),
};

        return res.status(200).json(buildCompleteNutrition(fromOpenFoodFacts));
      }
    }

    /* -------------------------------- 2) Nutritionix ------------------------------- */
   
    /* ---------------------------------- 3) GPT ----------------------------------- */
    if (!OPENAI_API_KEY)
      return res.status(500).json({ error: "Missing OpenAI API key" });

    const systemPrompt = `
You are a nutrition data assistant with access to knowledge of common UPC patterns, Nutritionix-style entries, and OpenFoodFacts categories.
Given a barcode, your job is to return the most plausible *packaged food or drink* sold in North America.
Do NOT guess cosmetics, household, or chemical items.

If the code looks like a protein bar, energy drink, peanut butter, or similar, prefer those.
If the barcode cannot be identified at all, respond with:
{"error":"non_food","message":"Unknown or invalid barcode"}.

Respond ONLY with JSON containing:
{
  "name": "string",
  "brand": "string",
  "servingSize": "string",
  "type": "liquid" | "solid" | "portion" | "unknown" | "non_food",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fiber": 0,
  "sugar": 0,
  "sodium": 0,
  "source": "GPT-4o"
}
`;

    const gptResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Barcode: ${barcode}` },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    const gptJson = (await gptResp.json()) as OpenAIResponse;
    const content: string = gptJson?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonFromText(content);
    if (parsed?.error === "non_food")
      return res.status(200).json(parsed);
    if (!parsed)
      return res.status(200).json({ error: "parse_error", raw: content ?? "" });

    const guard = guardEdible({
      name: parsed?.name,
      brand: parsed?.brand,
      categories: "",
      categoriesTags: [],
      servingSize: parsed?.servingSize,
      nutriments: {
        "energy-kcal_100g": parsed?.calories,
        proteins_100g: parsed?.protein,
        carbohydrates_100g: parsed?.carbs,
        fat_100g: parsed?.fat,
      }
    });
    if (!guard.isEdible)
      return res.status(200).json({ error: "non_food", message: guard.reason });

    const fromGpt = {
      name: parsed?.name,
      brand: parsed?.brand,
      source: "GPT-4o",
      type: parsed?.type,
      servingSize: parsed?.servingSize,
      baseAmount: safeNum(parsed?.baseAmount) || 100,
      baseUnit: parsed?.baseUnit || "g",
      calories: parsed?.calories,
      protein: parsed?.protein,
      carbs: parsed?.carbs,
      fat: parsed?.fat,
      fiber: parsed?.fiber,
      sugar: parsed?.sugar,
      sodium: parsed?.sodium,
    };
    return res.status(200).json(buildCompleteNutrition(fromGpt));
  } catch (err: any) {
    console.error("❌ Barcode API failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
