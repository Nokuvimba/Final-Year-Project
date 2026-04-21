import { API_BASE, handleJson } from "./http";
import type { FloorPlan, BuildingFloorPlans } from "./types";

export async function fetchBuildingFloorPlans(
  buildingId: number
): Promise<BuildingFloorPlans> {
  const res = await fetch(
    `${API_BASE}/buildings/${buildingId}/floorplans`,
    { cache: "no-store" }
  );
  return handleJson(res);
}

export async function uploadFloorPlan(
  buildingId: number,
  floorName: string,
  file: File
): Promise<FloorPlan> {
  const formData = new FormData();
  formData.append("building_id", buildingId.toString());
  formData.append("floor_name", floorName);
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/floorplans`, {
    method: "POST",
    body: formData,
  });
  const data = await handleJson<{ floorplan: FloorPlan }>(res);
  return data.floorplan;
}

export async function createFloorPlanFromUrl(
  buildingId: number,
  floorName: string,
  imageUrl: string
): Promise<FloorPlan> {
  const res = await fetch(`${API_BASE}/floorplans/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      building_id: buildingId,
      floor_name: floorName,
      image_url: imageUrl,
    }),
  });
  const data = await handleJson<{ floorplan: FloorPlan }>(res);
  return data.floorplan;
}

export async function updateFloorPlan(
  floorplanId: number,
  buildingId: number,
  floorName: string,
  imageUrl?: string
): Promise<FloorPlan> {
  const res = await fetch(`${API_BASE}/floorplans/${floorplanId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      building_id: buildingId,
      floor_name: floorName,
      image_url: imageUrl,
    }),
  });
  const data = await handleJson<{ floorplan: FloorPlan }>(res);
  return data.floorplan;
}

export async function renameFloorPlan(
  floorplanId: number,
  floorName: string
): Promise<FloorPlan> {
  const res = await fetch(`${API_BASE}/floorplans/${floorplanId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ floor_name: floorName }),
  });
  const data = await handleJson<{ floorplan: FloorPlan }>(res);
  return data.floorplan;
}

export async function deleteFloorPlan(floorplanId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/floorplans/${floorplanId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed: ${res.status} ${text}`);
  }
}
