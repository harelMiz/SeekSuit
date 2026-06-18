import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

export interface VTOModel {
  name: string;
  url:  string;
}

export async function listVTOModels(): Promise<VTOModel[]> {
  const { data } = await axios.get<VTOModel[]>(`${API_BASE}/api/vto-models`);
  return data;
}

export async function uploadVTOModel(file: File): Promise<VTOModel> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await axios.post<VTOModel>(`${API_BASE}/api/vto-models`, form);
  return data;
}

export async function deleteVTOModel(filename: string): Promise<void> {
  await axios.delete(`${API_BASE}/api/vto-models/${encodeURIComponent(filename)}`);
}
