import { API_BASE, handleJson } from "./http";
import type { Building } from "./types";

export async function fetchBuildings(): Promise<Building[]> {
  const res = await fetch(`${API_BASE}/buildings`, { cache: "no-store" });
  const data = await handleJson<{ buildings: Building[] }>(res);
  return data.buildings ?? [];
}

export async function createBuilding(payload: {
  name: string;
  description?: string;
}): Promise<Building> {
  const res = await fetch(`${API_BASE}/buildings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ building: Building }>(res);
  return data.building;
}

export async function updateBuilding(
  buildingId: number,
  payload: {
    name?: string;
    description?: string;
  }
): Promise<Building> {
  const res = await fetch(`${API_BASE}/buildings/${buildingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ building: Building }>(res);
  return data.building;
}

export async function deleteBuilding(buildingId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/buildings/${buildingId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed: ${res.status} ${text}`);
  }
}
