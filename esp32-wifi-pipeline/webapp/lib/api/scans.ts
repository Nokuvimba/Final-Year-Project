import { API_BASE, handleJson } from "./http";
import type { WifiScan, RoomScanData, BuildingWifiRow } from "./types";

export async function fetchRecentScans(limit = 25): Promise<WifiScan[]> {
  const res = await fetch(
    `${API_BASE}/wifi/rawScans?limit=${limit}`,
    { cache: "no-store" }
  );
  const data = await handleJson<{ rows: WifiScan[] }>(res);
  return data.rows ?? [];
}

export async function fetchRoomScans(
  roomId: number,
  limit = 100
): Promise<RoomScanData> {
  const res = await fetch(
    `${API_BASE}/rooms/${roomId}/wifi?limit=${limit}`,
    { cache: "no-store" }
  );
  return handleJson(res);
}

export async function fetchBuildingScans(
  buildingId: number,
  limit = 500
): Promise<{
  building: {
    id: number;
    name: string;
    description: string | null;
  };
  rows: BuildingWifiRow[];
}> {
  const res = await fetch(
    `${API_BASE}/buildings/${buildingId}/wifi?limit=${limit}`,
    { cache: "no-store" }
  );
  return handleJson(res);
}

export async function startRoomScan(roomId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/start-scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  await handleJson(res);
}

export async function stopRoomScan(roomId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/stop-scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  await handleJson(res);
}
