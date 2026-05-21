import FormData from 'form-data';
import fetch from 'node-fetch';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

// Send a raw image buffer to the Python AI service for processing.
// productType is the Prisma ProductType enum value (e.g. 'JACKET', 'PANTS').
// When null/undefined the AI service infers the type from the filename.
// Returns the processedImageUrl stored in Supabase.
export async function processImage(
  imageBuffer: Buffer,
  filename: string,
  productType?: string | null
): Promise<string> {
  const form = new FormData();
  form.append('file', imageBuffer, { filename, contentType: 'image/jpeg' });
  if (productType) form.append('product_type', productType);

  const response = await fetch(`${AI_SERVICE_URL}/process`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI service error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { processedImageUrl: string };
  return data.processedImageUrl;
}
