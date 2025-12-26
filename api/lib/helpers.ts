// helpers.ts

/* ---------- helpers ---------- */

export const languageInstruction = (lang: string) => {
  if (!lang || lang === "en") return "";
  return `All natural language text (ai_summary, summaries, descriptions) MUST be written in ${lang}.`;
};

export const safeNum = (v: any) => (Number.isFinite(+v) ? Math.round(+v) : 0);

export const buildCompleteNutrition = (d: any = {}) => ({
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

export const extractJson = (text: string) => {
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

/**
 * extract a quantity with unit from any text, e.g. "330 ml", "130g", "11 oz", "2 slices", etc.
 * Used to avoid turning "330 ml" into "330g" when building qtyLabel.
 */
export const extractQuantityFromText = (text?: string | null): string | null => {
  if (!text) return null;

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(ml|mL|l|L|liters?|litres?|fl\s*oz|oz|g|grams?|kg|lb|pounds?|cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|slices?|slice|piece|pieces|servings?|serving|bottle|bottles?|can|cans?)/i
  );

  if (!match) return null;

  const value = match[1];
  const unit = match[2];
  return `${value} ${unit}`;
};

export const normalizeAiFoods = (foods: any[], fallbackName: string) => {
  if (!Array.isArray(foods) || foods.length === 0) {
    return [{ name: fallbackName, weight_g: null, confidence: 1 }];
  }

  return foods.map((f) => ({
    name: f.name || fallbackName,
    // 🔒 Never allow undefined; null explicitly means “serving-based”
    weight_g: Number.isFinite(f.weight_g) ? Math.round(f.weight_g) : null,
    confidence: Number.isFinite(f.confidence) ? f.confidence : 1,
  }));
};
