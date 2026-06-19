import api from './api';

export interface VTOModelPhoto  { name: string; url: string; }
export interface VTOModelFolder { name: string; photos: VTOModelPhoto[]; }

export async function listVTOModelFolders(): Promise<VTOModelFolder[]> {
  const { data } = await api.get<VTOModelFolder[]>('/vto-models');
  return data;
}

export async function uploadVTOModelPhoto(folderName: string, file: File): Promise<VTOModelPhoto> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<VTOModelPhoto>(`/vto-models/${encodeURIComponent(folderName)}/photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteVTOModelFolder(folderName: string): Promise<void> {
  await api.delete(`/vto-models/${encodeURIComponent(folderName)}`);
}

export async function deleteVTOModelPhoto(folderName: string, filename: string): Promise<void> {
  await api.delete(`/vto-models/${encodeURIComponent(folderName)}/photos/${encodeURIComponent(filename)}`);
}

export async function renameVTOModelFolder(folderName: string, newName: string): Promise<void> {
  await api.patch(`/vto-models/${encodeURIComponent(folderName)}/rename`, { newName });
}
