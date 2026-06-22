import api from "./api";

export interface CustomColor {
  id: string;
  key: string;
  labelHe: string;
  labelEn: string;
  hex: string;
  createdAt: string;
}

export async function fetchColors(): Promise<CustomColor[]> {
  const { data } = await api.get<CustomColor[]>("/colors");
  return data;
}

export async function addColor(
  payload: Omit<CustomColor, "id" | "createdAt">,
): Promise<CustomColor> {
  const { data } = await api.post<CustomColor>("/colors", payload);
  return data;
}
