/**
 * One-time backfill: detects and stores dominantColor for all ProductImage rows
 * that have a processedUrl but no dominantColor yet.
 *
 * Requires: AI service running on localhost:8001, DATABASE_URL in Backend/.env
 * Usage: node Backend/scripts/backfill-dominant-color.mjs
 *        (run from the SeekSuit project root)
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Client } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const AI_SERVICE_URL = 'http://localhost:8001';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query(`
    SELECT id, "processedUrl"
    FROM "ProductImage"
    WHERE "processedUrl" IS NOT NULL
      AND "dominantColor" IS NULL
    ORDER BY "createdAt" ASC
  `);

  if (rows.length === 0) {
    console.log('No images to backfill — all have dominantColor already.');
    await client.end();
    return;
  }

  console.log(`Backfilling dominantColor for ${rows.length} images...\n`);
  let updated = 0, skipped = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prefix = `[${i + 1}/${rows.length}] ${row.id.slice(0, 8)}…`;

    try {
      // Download the processed image from Supabase Storage
      const imgResp = await fetch(row.processedUrl);
      if (!imgResp.ok) throw new Error(`Image download HTTP ${imgResp.status}`);
      const arrayBuf = await imgResp.arrayBuffer();

      // Send to AI service /embed — returns embedding + dominantColor
      const form = new FormData();
      form.append('file', new Blob([arrayBuf], { type: 'image/jpeg' }), 'image.jpg');

      const aiResp = await fetch(`${AI_SERVICE_URL}/embed`, {
        method: 'POST',
        body: form,
      });
      if (!aiResp.ok) {
        const text = await aiResp.text();
        throw new Error(`AI service HTTP ${aiResp.status}: ${text}`);
      }

      const { dominantColor } = await aiResp.json();

      if (dominantColor) {
        await client.query(
          `UPDATE "ProductImage" SET "dominantColor" = $1 WHERE id = $2`,
          [dominantColor, row.id]
        );
        console.log(`  ✓ ${prefix} → ${dominantColor}`);
        updated++;
      } else {
        console.log(`  ⚠ ${prefix} → no foreground pixels detected (left NULL)`);
        skipped++;
      }
    } catch (err) {
      console.error(`  ✗ ${prefix} → ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Done: ${updated} updated, ${skipped} no-color, ${failed} failed`);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
