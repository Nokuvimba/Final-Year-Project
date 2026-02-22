import { API_BASE, handleJson } from "./http";
import type { HeatmapPoint } from "./types";

export async function fetchFloorplanHeatmap(
  floorplanId: number
): Promise<HeatmapPoint[]> {
  const res = await fetch(
    `${API_BASE}/heatmap/floorplan/${floorplanId}/latest`,
    { cache: "no-store" }
  );
  return handleJson(res);
}
