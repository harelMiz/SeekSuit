import api from './api';

export interface VTOModel {
  name: string;
  url:  string;
}

export async function listVTOModels(): Promise<VTOModel[]> {
  const { data } = await api.get<VTOModel[]>('/vto-models');
  return data;
}

export async function uploadVTOModel(file: File): Promise<VTOModel> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<VTOModel>('/vto-models', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteVTOModel(filename: string): Promise<void> {
  await api.delete(`/vto-models/${encodeURIComponent(filename)}`);
}
