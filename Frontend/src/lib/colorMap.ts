// Maps English color keys (stored in DB) to Hebrew display labels.
// Keys follow the pattern: BASE, LIGHT_BASE, DARK_BASE, BASE_DOTTED, BASE_STRIPED.
// If a product has a color key not in this map, the key itself is displayed as fallback.

export const COLOR_LABELS: Record<string, string> = {
  BLACK:              "שחור",
  LIGHT_BLACK:        "שחור בהיר",
  DARK_BLACK:         "שחור כהה",
  BLACK_DOTTED:       "שחור מנוקד",
  BLACK_STRIPED:      "שחור מפוספס",

  WHITE:              "לבן",
  LIGHT_WHITE:        "לבן בהיר",
  DARK_WHITE:         "לבן כהה",
  WHITE_DOTTED:       "לבן מנוקד",
  WHITE_STRIPED:      "לבן מפוספס",

  BROWN:              "חום",
  LIGHT_BROWN:        "חום בהיר",
  DARK_BROWN:         "חום כהה",
  BROWN_DOTTED:       "חום מנוקד",
  BROWN_STRIPED:      "חום מפוספס",

  RED:                "אדום",
  LIGHT_RED:          "אדום בהיר",
  DARK_RED:           "אדום כהה",
  RED_DOTTED:         "אדום מנוקד",
  RED_STRIPED:        "אדום מפוספס",

  GRAY:               "אפור",
  LIGHT_GRAY:         "אפור בהיר",
  DARK_GRAY:          "אפור כהה",
  GRAY_DOTTED:        "אפור מנוקד",
  GRAY_STRIPED:       "אפור מפוספס",

  SKY_BLUE:           "תכלת",
  LIGHT_SKY_BLUE:     "תכלת בהיר",
  DARK_SKY_BLUE:      "תכלת כהה",
  SKY_BLUE_DOTTED:    "תכלת מנוקד",
  SKY_BLUE_STRIPED:   "תכלת מפוספס",

  YELLOW:             "צהוב",
  LIGHT_YELLOW:       "צהוב בהיר",
  DARK_YELLOW:        "צהוב כהה",
  YELLOW_DOTTED:      "צהוב מנוקד",
  YELLOW_STRIPED:     "צהוב מפוספס",

  CREAM:              "קרם",
  LIGHT_CREAM:        "קרם בהיר",
  DARK_CREAM:         "קרם כהה",
  CREAM_DOTTED:       "קרם מנוקד",
  CREAM_STRIPED:      "קרם מפוספס",

  IVORY:              "שמנת",
  LIGHT_IVORY:        "שמנת בהיר",
  DARK_IVORY:         "שמנת כהה",
  IVORY_DOTTED:       "שמנת מנוקד",
  IVORY_STRIPED:      "שמנת מפוספס",

  PURPLE:             "סגול",
  LIGHT_PURPLE:       "סגול בהיר",
  DARK_PURPLE:        "סגול כהה",
  PURPLE_DOTTED:      "סגול מנוקד",
  PURPLE_STRIPED:     "סגול מפוספס",

  NAVY:               "כחול",
  LIGHT_NAVY:         "כחול בהיר",
  DARK_NAVY:          "כחול כהה",
  NAVY_DOTTED:        "כחול מנוקד",
  NAVY_STRIPED:       "כחול מפוספס",

  ORANGE:             "כתום",
  LIGHT_ORANGE:       "כתום בהיר",
  DARK_ORANGE:        "כתום כהה",
  ORANGE_DOTTED:      "כתום מנוקד",
  ORANGE_STRIPED:     "כתום מפוספס",

  GREEN:              "ירוק",
  LIGHT_GREEN:        "ירוק בהיר",
  DARK_GREEN:         "ירוק כהה",
  GREEN_DOTTED:       "ירוק מנוקד",
  GREEN_STRIPED:      "ירוק מפוספס",

  OLIVE:              "ירוק זית",
  LIGHT_OLIVE:        "ירוק זית בהיר",
  DARK_OLIVE:         "ירוק זית כהה",
  OLIVE_DOTTED:       "ירוק זית מנוקד",
  OLIVE_STRIPED:      "ירוק זית מפוספס",

  PINK:               "ורוד",
  LIGHT_PINK:         "ורוד בהיר",
  DARK_PINK:          "ורוד כהה",
  PINK_DOTTED:        "ורוד מנוקד",
  PINK_STRIPED:       "ורוד מפוספס",

  BURGUNDY:           "בורדו",
  LIGHT_BURGUNDY:     "בורדו בהיר",
  DARK_BURGUNDY:      "בורדו כהה",
  BURGUNDY_DOTTED:    "בורדו מנוקד",
  BURGUNDY_STRIPED:   "בורדו מפוספס",

  TURQUOISE:          "טורקיז",
  LIGHT_TURQUOISE:    "טורקיז בהיר",
  DARK_TURQUOISE:     "טורקיז כהה",
  TURQUOISE_DOTTED:   "טורקיז מנוקד",
  TURQUOISE_STRIPED:  "טורקיז מפוספס",

  BEIGE:              "בז'",
  LIGHT_BEIGE:        "בז' בהיר",
  DARK_BEIGE:         "בז' כהה",
  BEIGE_DOTTED:       "בז' מנוקד",
  BEIGE_STRIPED:      "בז' מפוספס",
};

// Ordered list for the color combobox in the admin form.
export const COLOR_OPTIONS = Object.keys(COLOR_LABELS);

// Returns the Hebrew label for a color key, or the key itself as fallback.
export function colorLabel(key: string | null | undefined): string {
  if (!key) return "";
  return COLOR_LABELS[key] ?? key;
}

function keyToEnglishLabel(key: string): string {
  return key.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

// Returns a bilingual display label: Hebrew for "he", formatted English for "en".
export function colorDisplay(key: string | null | undefined, lang: "he" | "en"): string {
  if (!key) return "";
  if (lang === "en") return keyToEnglishLabel(key);
  return COLOR_LABELS[key] ?? key;
}

// Base colors used by the AI embedder for color detection and search boosting.
export const BASE_COLORS = [
  "BLACK", "WHITE", "BROWN", "RED", "GRAY", "SKY_BLUE", "YELLOW",
  "CREAM", "IVORY", "PURPLE", "NAVY", "ORANGE", "GREEN", "OLIVE",
  "PINK", "BURGUNDY", "TURQUOISE", "BEIGE",
];
