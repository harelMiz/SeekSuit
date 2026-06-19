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
// Bucket structure: vto-models/<folderName>/<photo.jpg>

export interface VTOModelPhoto  { name: string; url: string; }
export interface VTOModelFolder { name: string; photos: VTOModelPhoto[]; }

const SIGNED_TTL = 60 * 60 * 24 * 365 * 10; // 10 years

function validateFolderName(name: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid folder name');
}
function validatePhotoName(name: string) {
  if (!/^[a-zA-Z0-9_.-]+\.(jpe?g|png)$/i.test(name) || name.includes('/') || name.includes('..'))
    throw new Error('Invalid photo filename');
}

async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(VTO_MODELS_BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error || !data) throw new Error(`Failed to sign URL for ${path}`);
  return data.signedUrl;
}

export async function listVTOModelFolders(): Promise<VTOModelFolder[]> {
  const { data: folders, error } = await supabase.storage
    .from(VTO_MODELS_BUCKET)
    .list('', { sortBy: { column: 'name', order: 'asc' }, limit: 200 });
  if (error) throw new Error(`Failed to list vto-models: ${error.message}`);

  return Promise.all(
    (folders ?? []).map(async (folder) => {
      const { data: files } = await supabase.storage
        .from(VTO_MODELS_BUCKET)
        .list(folder.name, { sortBy: { column: 'name', order: 'asc' }, limit: 200 });

      const photos = await Promise.all(
        (files ?? [])
          .filter(f => /\.(jpe?g|png)$/i.test(f.name))
          .map(async (f) => ({ name: f.name, url: await signedUrl(`${folder.name}/${f.name}`) }))
      );
      return { name: folder.name, photos };
    })
  );
}

export async function uploadVTOModelPhoto(
  folderName: string,
  buffer: Buffer,
  originalName: string,
): Promise<VTOModelPhoto> {
  validateFolderName(folderName);
  const safe = originalName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '');
  const ext  = safe.match(/\.[^.]+$/)?.[0] ?? '.jpg';
  const stem = safe.replace(/\.[^.]+$/, '');
  const name = `${stem}_${Date.now()}${ext}`;
  const path = `${folderName}/${name}`;

  const { error } = await supabase.storage
    .from(VTO_MODELS_BUCKET)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`VTO model upload failed: ${error.message}`);

  return { name, url: await signedUrl(path) };
}

export async function deleteVTOModelFolder(folderName: string): Promise<void> {
  validateFolderName(folderName);
  const { data: files } = await supabase.storage
    .from(VTO_MODELS_BUCKET)
    .list(folderName, { limit: 200 });
  if (!files?.length) return;
  await supabase.storage.from(VTO_MODELS_BUCKET).remove(files.map(f => `${folderName}/${f.name}`));
}

export async function deleteVTOModelPhoto(folderName: string, filename: string): Promise<void> {
  validateFolderName(folderName);
  validatePhotoName(filename);
  const { error } = await supabase.storage.from(VTO_MODELS_BUCKET).remove([`${folderName}/${filename}`]);
  if (error) throw new Error(`Failed to delete photo: ${error.message}`);
}

export async function renameVTOModelFolder(oldName: string, newName: string): Promise<void> {
  validateFolderName(oldName);
  validateFolderName(newName);

  const { data: files } = await supabase.storage
    .from(VTO_MODELS_BUCKET)
    .list(oldName, { limit: 200 });
  if (!files?.length) throw new Error('Source folder not found or empty');

  // Copy each file to new folder path
  await Promise.all(
    files.map(f =>
      supabase.storage.from(VTO_MODELS_BUCKET).copy(`${oldName}/${f.name}`, `${newName}/${f.name}`)
    )
  );

  // Remove originals
  await supabase.storage.from(VTO_MODELS_BUCKET).remove(files.map(f => `${oldName}/${f.name}`));
}

// Generate a short-lived signed URL for a raw image (used internally by the AI service)
export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RAW_BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour expiry

  if (error || !data) throw new Error(`Failed to create signed URL: ${error?.message}`);
  return data.signedUrl;
}
