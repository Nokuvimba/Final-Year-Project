// webapp/lib/api.ts
//This file is talking to fastapi backend
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"; 

export type Building = {
  id: number;
  name: string;
  description: string | null;
};

export type Room = {
  id: number;
  name: string;
  building_id: number;
  building_name: string;
  floor: string | null;
  room_type: string | null;
};

export type WifiScan = {
  id: number;
  received_at: string;
  node: string | null;
  ssid: string | null;
  bssid: string | null;
  rssi: number | null;
  channel: number | null;
  enc: string | null;
  room_id: number | null;
};

export async function fetchBuildings(): Promise<Building[]> {
  const res = await fetch(`${API_BASE}/buildings`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load buildings");
  const data = await res.json();
  return data.buildings ?? [];
}

export async function fetchRooms(
  buildingId?: number
): Promise<Room[]> {
  const url =
    buildingId != null
      ? `${API_BASE}/rooms?building_id=${buildingId}`
      : `${API_BASE}/rooms`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load rooms");
  const data = await res.json();
  return data.rooms ?? [];
}

export async function fetchRecentScans(
  limit = 25
): Promise<WifiScan[]> {
  const res = await fetch(
    `${API_BASE}/wifi/recent?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load recent scans");
  const data = await res.json();
  return data.rows ?? [];
}