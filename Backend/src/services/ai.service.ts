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
  dominantColorFamily: string[] | null;
}

export interface DetectedItem {
  type: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  cropDataUrl: string;
}

export interface DetectResult {
  items: DetectedItem[];
  multipleFound: boolean;
}

// Send an arbitrary image to the AI service and get its CLIP embedding
// plus the detected dominant color category (e.g. "BEIGE", "BLACK").
// clean=true triggers BiRefNet background removal before embedding — use when
// the image is a contextual crop (e.g. item picker selection from a full outfit photo).
export async function embedImage(
  imageBuffer: Buffer,
  filename: string,
  options: { clean?: boolean; productType?: string } = {}
): Promise<EmbedResult> {
  const form = new FormData();
  form.append('file', imageBuffer, { filename, contentType: 'image/jpeg' });

  const qs = new URLSearchParams();
  if (options.clean) qs.set('clean', 'true');
  if (options.productType) qs.set('product_type', options.productType);
  const url = `${AI_SERVICE_URL}/embed${qs.toString() ? '?' + qs.toString() : ''}`;

  const response = await fetch(url, {
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

// Send an image to the AI service and detect multiple clothing items within it.
// Returns bounding boxes + crop previews so the frontend can show an item picker.
export async function detectItems(imageBuffer: Buffer, filename: string): Promise<DetectResult> {
  const form = new FormData();
  form.append('file', imageBuffer, { filename, contentType: 'image/jpeg' });

  const response = await fetch(`${AI_SERVICE_URL}/detect`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI detect error ${response.status}: ${text}`);
  }

  return (await response.json()) as DetectResult;
}
