// prompts.ts

/** Shared schema text used in all nutrition prompts */
export const NUTRITION_JSON_SCHEMA = `{
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
