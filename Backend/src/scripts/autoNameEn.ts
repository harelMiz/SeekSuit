/**
 * One-time migration: auto-generate nameEn for products without one.
 * Builds English name from type + color (both already stored as English keys in DB).
 * Example: type=JACKET, color=LIGHT_NAVY → "Light Navy Jacket"
 *
 * Run from Backend directory (same way dev server uses ts-node):
 *   npx ts-node src/scripts/autoNameEn.ts
 */

import prisma from "../lib/prisma";

const TYPE_LABELS: Record<string, string> = {
  JACKET:  "Jacket",
  PANTS:   "Pants",
  SHIRT:   "Shirt",
  VEST:    "Vest",
  SHOES:   "Shoes",
  TIE:     "Tie",
  BOW_TIE: "Bow Tie",
  BELT:    "Belt",
};

function colorToEnglish(key: string): string {
  return key.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

function buildNameEn(type: string, color: string | null): string {
  const typeLabel = TYPE_LABELS[type] ?? type;
  const colorPart = color ? colorToEnglish(color) + " " : "";
  return `${colorPart}${typeLabel}`;
}

async function main() {
  const products = await prisma.product.findMany();

  let updated = 0;
  let skipped = 0;

  for (const p of products) {
    const attrs = (p.attributes as Record<string, unknown>) ?? {};

    if (attrs.nameEn) {
      console.log(`— skip  "${p.name}"  (already has nameEn: "${attrs.nameEn}")`);
      skipped++;
      continue;
    }

    const nameEn = buildNameEn(p.type, p.color);

    await prisma.product.update({
      where: { id: p.id },
      data: { attributes: { ...attrs, nameEn } },
    });

    console.log(`✓  "${p.name}"  →  "${nameEn}"`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated} | Skipped: ${skipped}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => process.exit(0));
