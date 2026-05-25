import FormData from 'form-data';
import fetch from 'node-fetch';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

export interface ProcessResult {
  processedImageUrl: string;
  embedding: number[];
  dominantColor: string | null;
}

// Send a raw image buffer to the Python AI service for background removal,
// enhancement, canvas normalization, and CLIP embedding.
// productType selects the right BiRefNet variant; null falls back to filename inference.
export async function processImage(
  imageBuffer: Buffer,
  filename: string,
  productType?: string | null
): Promise<ProcessResult> {
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

  return (await response.json()) as ProcessResult;
}

export interface EmbedTextResult {
  embedding: number[];
}

// Send a text query to the AI service and get its CLIP text embedding.
// The 512-dim vector lives in the same space as image embeddings for cross-modal search.
export async function embedText(text: string): Promise<EmbedTextResult> {
  const form = new FormData();
  form.append('text', text);

  const response = await fetch(`${AI_SERVICE_URL}/embed-text`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`AI text embed error ${response.status}: ${responseText}`);
  }

  return (await response.json()) as EmbedTextResult;
}

export interface EmbedResult {
  embedding: number[];
  dominantColor: string | null;
}

// Send an arbitrary image to the AI service and get its CLIP embedding
// plus the detected dominant color category (e.g. "BEIGE", "BLACK").
// Used for query-time visual search — no background removal is applied.
export async function embedImage(imageBuffer: Buffer, filename: string): Promise<EmbedResult> {
  const form = new FormData();
  form.append('file', imageBuffer, { filename, contentType: 'image/jpeg' });

  const response = await fetch(`${AI_SERVICE_URL}/embed`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI embed error ${response.status}: ${text}`);
  }

  return (await response.json()) as EmbedResult;
}
