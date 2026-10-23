export const ALLERGEN_CODES = [
  "egg",
  "milk",
  "peanut",
  "tree_nuts",
  "sesame",
  "gluten",
  "soy",
  "fish",
  "crustaceans",
  "mango",
  "sulfites",
] as const;

export type AllergenCode = typeof ALLERGEN_CODES[number];

const allergenCodeSet = new Set<string>(ALLERGEN_CODES);

export function normalizeAllergenCodes(value: unknown): AllergenCode[] | null {
  if (!Array.isArray(value)) return null;
  const normalized: AllergenCode[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allergenCodeSet.has(item)) return null;
    if (!normalized.includes(item as AllergenCode)) normalized.push(item as AllergenCode);
  }
  return normalized;
}

export function parseStoredAllergenCodes(value: string | null): AllergenCode[] {
  if (!value) return [];
  try {
    return normalizeAllergenCodes(JSON.parse(value)) ?? [];
  } catch {
    return [];
  }
}
