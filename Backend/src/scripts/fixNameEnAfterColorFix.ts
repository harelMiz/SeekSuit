/**
 * Follow-up to fixColorKeys: re-generates nameEn for products
 * where nameEn contains Hebrew characters (was generated before color was fixed).
 * Run from Backend directory:
 *   npx ts-node src/scripts/fixNameEnAfterColorFix.ts
 */

import dotenv from "dotenv";
dotenv.config();

import prisma from "../lib/prisma";

const TYPE_LABELS: Record<string, string> = {
  JACKET: "Jacket", PANTS: "Pants", SHIRT: "Shirt", VEST: "Vest",
  SHOES: "Shoes", TIE: "Tie", BOW_TIE: "Bow Tie", BELT: "Belt",
};

function colorToEnglish(key: string): string {
  return key.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

function buildNameEn(type: string, color: string | null): string {
  const typeLabel = TYPE_LABELS[type] ?? type;
  const colorPart = color ? colorToEnglish(color) + " " : "";
  return `${colorPart}${typeLabel}`;
}

function containsHebrew(s: string): boolean {
  return /[֐-׿]/.test(s);
}

async function main() {
  const products = await prisma.product.findMany();

  let updated = 0;
  let skipped = 0;

  for (const p of products) {
    const attrs = (p.attributes as Record<string, unknown>) ?? {};
    const existing = attrs.nameEn as string | undefined;

    // Only fix nameEn values that still contain Hebrew
    if (!existing || !containsHebrew(existing)) { skipped++; continue; }

    const nameEn = buildNameEn(p.type, p.color);

    await prisma.product.update({
      where: { id: p.id },
      data: { attributes: { ...attrs, nameEn } },
    });

    console.log(`✓  "${p.name}"  "${existing}"  →  "${nameEn}"`);
    updated++;
  }

  console.log(`\nDone. Fixed: ${updated} | Skipped: ${skipped}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => process.exit(0));
