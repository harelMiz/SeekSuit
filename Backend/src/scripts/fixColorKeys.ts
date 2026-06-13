/**
 * One-time migration: fix products whose color field contains a Hebrew string
 * instead of the expected English enum key (e.g. "שחור" → "BLACK").
 * Builds an inverted lookup from COLOR_LABELS (English key → Hebrew) used in the frontend.
 *
 * Run from Backend directory:
 *   npx ts-node src/scripts/fixColorKeys.ts
 */

import dotenv from "dotenv";
dotenv.config();

import prisma from "../lib/prisma";

// Copied from frontend colorMap — English key → Hebrew label
const COLOR_LABELS: Record<string, string> = {
  BLACK: "שחור", LIGHT_BLACK: "שחור בהיר", DARK_BLACK: "שחור כהה",
  BLACK_DOTTED: "שחור מנוקד", BLACK_STRIPED: "שחור מפוספס",
  WHITE: "לבן", LIGHT_WHITE: "לבן בהיר", DARK_WHITE: "לבן כהה",
  WHITE_DOTTED: "לבן מנוקד", WHITE_STRIPED: "לבן מפוספס",
  BROWN: "חום", LIGHT_BROWN: "חום בהיר", DARK_BROWN: "חום כהה",
  BROWN_DOTTED: "חום מנוקד", BROWN_STRIPED: "חום מפוספס",
  RED: "אדום", LIGHT_RED: "אדום בהיר", DARK_RED: "אדום כהה",
  RED_DOTTED: "אדום מנוקד", RED_STRIPED: "אדום מפוספס",
  GRAY: "אפור", LIGHT_GRAY: "אפור בהיר", DARK_GRAY: "אפור כהה",
  GRAY_DOTTED: "אפור מנוקד", GRAY_STRIPED: "אפור מפוספס",
  SKY_BLUE: "תכלת", LIGHT_SKY_BLUE: "תכלת בהיר", DARK_SKY_BLUE: "תכלת כהה",
  SKY_BLUE_DOTTED: "תכלת מנוקד", SKY_BLUE_STRIPED: "תכלת מפוספס",
  YELLOW: "צהוב", LIGHT_YELLOW: "צהוב בהיר", DARK_YELLOW: "צהוב כהה",
  YELLOW_DOTTED: "צהוב מנוקד", YELLOW_STRIPED: "צהוב מפוספס",
  CREAM: "קרם", LIGHT_CREAM: "קרם בהיר", DARK_CREAM: "קרם כהה",
  CREAM_DOTTED: "קרם מנוקד", CREAM_STRIPED: "קרם מפוספס",
  IVORY: "שמנת", LIGHT_IVORY: "שמנת בהיר", DARK_IVORY: "שמנת כהה",
  IVORY_DOTTED: "שמנת מנוקד", IVORY_STRIPED: "שמנת מפוספס",
  PURPLE: "סגול", LIGHT_PURPLE: "סגול בהיר", DARK_PURPLE: "סגול כהה",
  PURPLE_DOTTED: "סגול מנוקד", PURPLE_STRIPED: "סגול מפוספס",
  NAVY: "כחול", LIGHT_NAVY: "כחול בהיר", DARK_NAVY: "כחול כהה",
  NAVY_DOTTED: "כחול מנוקד", NAVY_STRIPED: "כחול מפוספס",
  ORANGE: "כתום", LIGHT_ORANGE: "כתום בהיר", DARK_ORANGE: "כתום כהה",
  ORANGE_DOTTED: "כתום מנוקד", ORANGE_STRIPED: "כתום מפוספס",
  GREEN: "ירוק", LIGHT_GREEN: "ירוק בהיר", DARK_GREEN: "ירוק כהה",
  GREEN_DOTTED: "ירוק מנוקד", GREEN_STRIPED: "ירוק מפוספס",
  OLIVE: "ירוק זית", LIGHT_OLIVE: "ירוק זית בהיר", DARK_OLIVE: "ירוק זית כהה",
  OLIVE_DOTTED: "ירוק זית מנוקד", OLIVE_STRIPED: "ירוק זית מפוספס",
  PINK: "ורוד", LIGHT_PINK: "ורוד בהיר", DARK_PINK: "ורוד כהה",
  PINK_DOTTED: "ורוד מנוקד", PINK_STRIPED: "ורוד מפוספס",
  BURGUNDY: "בורדו", LIGHT_BURGUNDY: "בורדו בהיר", DARK_BURGUNDY: "בורדו כהה",
  BURGUNDY_DOTTED: "בורדו מנוקד", BURGUNDY_STRIPED: "בורדו מפוספס",
  TURQUOISE: "טורקיז", LIGHT_TURQUOISE: "טורקיז בהיר", DARK_TURQUOISE: "טורקיז כהה",
  TURQUOISE_DOTTED: "טורקיז מנוקד", TURQUOISE_STRIPED: "טורקיז מפוספס",
  BEIGE: "בז'", LIGHT_BEIGE: "בז' בהיר", DARK_BEIGE: "בז' כהה",
  BEIGE_DOTTED: "בז' מנוקד", BEIGE_STRIPED: "בז' מפוספס",
};

// Invert: Hebrew label → English key
const HE_TO_KEY: Record<string, string> = {};
for (const [key, label] of Object.entries(COLOR_LABELS)) {
  HE_TO_KEY[label] = key;
}

function isEnglishKey(color: string): boolean {
  return COLOR_LABELS[color] !== undefined;
}

async function main() {
  const products = await prisma.product.findMany();

  let updated = 0;
  let skipped = 0;
  let unknown = 0;

  for (const p of products) {
    if (!p.color) { skipped++; continue; }

    // Already a valid English key — nothing to do
    if (isEnglishKey(p.color)) { skipped++; continue; }

    // Try to map Hebrew → English key
    const englishKey = HE_TO_KEY[p.color];

    if (!englishKey) {
      console.log(`? UNKNOWN  "${p.name}"  color="${p.color}"  — skipping`);
      unknown++;
      continue;
    }

    await prisma.product.update({
      where: { id: p.id },
      data: { color: englishKey },
    });

    console.log(`✓  "${p.name}"  "${p.color}"  →  "${englishKey}"`);
    updated++;
  }

  console.log(`\nDone. Fixed: ${updated} | Already correct: ${skipped} | Unknown: ${unknown}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => process.exit(0));
