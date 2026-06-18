import { createClient } from '@supabase/supabase-js';

// Use service-role key — never expose this to the frontend
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RAW_BUCKET        = 'raw-images';
const VTO_MODELS_BUCKET = 'vto-models';

// Upload a raw image buffer to Supabase Storage and return the storage path URL
export async function uploadRawImage(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const path = `products/${Date.now()}_${filename}`;

  const { error } = await supabase.storage
    .from(RAW_BUCKET)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  // Return a signed URL valid for 10 years — used as the stored rawImageUrl in the DB
  const { data, error: signError } = await supabase.storage
    .from(RAW_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

  if (signError || !data) throw new Error(`Failed to create signed URL: ${signError?.message}`);
  return data.signedUrl;
}

// Delete a file from Storage given its signed URL.
// Extracts the storage path from the URL and removes the object.
export async function deleteFileBySignedUrl(signedUrl: string, bucket: string): Promise<void> {
  try {
    const url = new URL(signedUrl);
    const marker = `/object/sign/${bucket}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return;
    const storagePath = decodeURIComponent(url.pathname.slice(idx + marker.length));
    await supabase.storage.from(bucket).remove([storagePath]);
  } catch {
    // Non-critical — don't block product deletion
  }
}

// ── VTO model photos (vto-models bucket) ─────────────────────────────────────

export interface VTOModelFile {
  name: string;
  url:  string;
}

export async function listVTOModels(): Promise<VTOModelFile[]> {
  const { data, error } = await supabase.storage.from(VTO_MODELS_BUCKET).list('', { sortBy: { column: 'name', order: 'asc' } });
  if (error) throw new Error(`Failed to list vto-models: ${error.message}`);

  const files = (data ?? []).filter(f => /\.(jpe?g|png)$/i.test(f.name));

  return Promise.all(
    files.map(async (f) => {
      const { data: signed, error: signErr } = await supabase.storage
        .from(VTO_MODELS_BUCKET)
        .createSignedUrl(f.name, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed) throw new Error(`Failed to sign URL for ${f.name}`);
      return { name: f.name, url: signed.signedUrl };
    })
  );
}

export async function uploadVTOModel(buffer: Buffer, originalName: string): Promise<VTOModelFile> {
  // Sanitize filename — lowercase, spaces → underscores
  const safe = originalName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '');
  const ext  = safe.match(/\.[^.]+$/)?.[0] ?? '.jpg';
  const stem = safe.replace(/\.[^.]+$/, '');
  const name = `${stem}_${Date.now()}${ext}`;

  const { error } = await supabase.storage
    .from(VTO_MODELS_BUCKET)
    .upload(name, buffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`VTO model upload failed: ${error.message}`);

  const { data: signed, error: signErr } = await supabase.storage
    .from(VTO_MODELS_BUCKET)
    .createSignedUrl(name, 60 * 60 * 24 * 365 * 10);
  if (signErr || !signed) throw new Error(`Failed to sign URL for ${name}`);

  return { name, url: signed.signedUrl };
}

export async function deleteVTOModel(filename: string): Promise<void> {
  if (!/^[a-zA-Z0-9_.-]+\.(jpe?g|png)$/i.test(filename) || filename.includes('/') || filename.includes('..')) {
    throw new Error('Invalid filename');
  }
  const { error } = await supabase.storage.from(VTO_MODELS_BUCKET).remove([filename]);
  if (error) throw new Error(`Failed to delete VTO model: ${error.message}`);
}

// Generate a short-lived signed URL for a raw image (used internally by the AI service)
export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RAW_BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour expiry

  if (error || !data) throw new Error(`Failed to create signed URL: ${error?.message}`);
  return data.signedUrl;
}
