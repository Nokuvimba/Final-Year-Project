// lib/api.ts
// Central API client for the Wi-Fi Indoor Mapping backend

const isServer = typeof window === "undefined";

const API_BASE = isServer
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api`
  : "/api";

export function getImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http")) return imageUrl;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return `${baseUrl}${imageUrl}`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

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
  floorplan_id: number | null;
  x: number | null;
  y: number | null;
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
  room_name?: string | null;
  building_id?: number | null;
  building_name?: string | null;
};

/**
 * Represents one ESP32 device and its current room assignment.
 * Replaces the old ScanSession type.
 */
export type Device = {
  node: string;              // e.g. "ESP32-LAB-01"
  room_id: number | null;
  room_name: string | null;
  building_id: number | null;
  building_name: string | null;
  assigned_at: string;
  is_active: boolean;        // true if room_id is not null
};

export type FloorPlan = {
  id: number;
  floor_name: string;
  image_url: string;
  created_at: string;
  building_id?: number;
};

export type BuildingFloorPlans = {
  building: { id: number; name: string };
  floorplans: FloorPlan[];
};

export type HeatmapPoint = {
  room_id: number;
  room_name: string;
  x: number | null;
  y: number | null;
  avg_rssi: number | null;
  level: "strong" | "medium" | "low" | "weak" | null;
  samples: number;
};

export type RoomWifiRow = {
  id: number;
  received_at: string;
  node: string | null;
  ssid: string | null;
  bssid: string | null;
  rssi: number | null;
  channel: number | null;
  enc: string | null;
  room_id: number;
};

export type BuildingWifiRow = RoomWifiRow & { room_name: string };

export type RoomScanData = {
  room: {
    id: number;
    name: string;
    floor: string | null;
    room_type: string | null;
    building_id: number;
    building_name: string;
  };
  rows: RoomWifiRow[];
};


// ── Helpers ────────────────────────────────────────────────────────────────────

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}


// ── Buildings ──────────────────────────────────────────────────────────────────

export async function fetchBuildings(): Promise<Building[]> {
  const res = await fetch(`${API_BASE}/buildings`, { cache: "no-store" });
  const data = await handleJson<{ buildings: Building[] }>(res);
  return data.buildings ?? [];
}

export async function createBuilding(
  payload: { name: string; description?: string }
): Promise<Building> {
  const res = await fetch(`${API_BASE}/buildings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ building: Building }>(res);
  return data.building;
}

export async function updateBuilding(
  id: number,
  payload: { name?: string; description?: string }
): Promise<Building> {
  const res = await fetch(`${API_BASE}/buildings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ building: Building }>(res);
  return data.building;
}

export async function deleteBuilding(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/buildings/${id}`, { method: "DELETE" });
  await handleJson(res);
}


// ── Rooms ──────────────────────────────────────────────────────────────────────

export async function fetchRooms(buildingId?: number): Promise<Room[]> {
  const url = buildingId
    ? `${API_BASE}/rooms?building_id=${buildingId}`
    : `${API_BASE}/rooms`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await handleJson<{ rooms: Room[] }>(res);
  return data.rooms ?? [];
}

export async function createRoom(payload: {
  name: string;
  building_id: number;
  floor?: string;
  room_type?: string;
}): Promise<Room> {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ room: Room }>(res);
  return data.room;
}

export async function updateRoom(
  id: number,
  payload: { name?: string; floor?: string; room_type?: string }
): Promise<Room> {
  const res = await fetch(`${API_BASE}/rooms/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ room: Room }>(res);
  return data.room;
}

export async function deleteRoom(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rooms/${id}`, { method: "DELETE" });
  await handleJson(res);
}

export async function updateRoomPosition(
  roomId: number,
  floorplanId: number,
  x: number,
  y: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/position`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ floorplan_id: floorplanId, x, y }),
  });
  await handleJson(res);
}


// ── Device management (replaces scan sessions) ─────────────────────────────────

/**
 * Get all known ESP32 devices and their current room assignments.
 */
export async function fetchDevices(): Promise<Device[]> {
  const res = await fetch(`${API_BASE}/devices`, { cache: "no-store" });
  const data = await handleJson<{ devices: Device[] }>(res);
  return data.devices ?? [];
}

/**
 * Assign an ESP32 node to a room.
 * All scans from this node will be tagged with this room until changed.
 */
export async function assignDeviceToRoom(
  node: string,
  roomId: number
): Promise<Device> {
  const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(node)}/assign-room/${roomId}`, {
    method: "POST",
  });
  return handleJson<Device>(res);
}

/**
 * Unassign a device — subsequent scans will have room_id = null.
 */
export async function clearDeviceRoom(node: string): Promise<void> {
  const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(node)}/clear-room`, {
    method: "POST",
  });
  await handleJson(res);
}


// ── Scans ──────────────────────────────────────────────────────────────────────

export async function fetchRecentScans(limit = 25): Promise<WifiScan[]> {
  const res = await fetch(`${API_BASE}/wifi/rawScans?limit=${limit}`, { cache: "no-store" });
  const data = await handleJson<{ rows: WifiScan[] }>(res);
  return data.rows ?? [];
}

export async function fetchRoomScans(roomId: number, limit = 100): Promise<RoomScanData> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/wifi?limit=${limit}`, { cache: "no-store" });
  return handleJson(res);
}

export async function fetchBuildingScans(
  buildingId: number,
  limit = 500
): Promise<{ building: { id: number; name: string; description: string | null }; rows: BuildingWifiRow[] }> {
  const res = await fetch(`${API_BASE}/buildings/${buildingId}/wifi?limit=${limit}`, { cache: "no-store" });
  return handleJson(res);
}


// ── Floor Plans ────────────────────────────────────────────────────────────────

export async function fetchBuildingFloorPlans(buildingId: number): Promise<BuildingFloorPlans> {
  const res = await fetch(`${API_BASE}/buildings/${buildingId}/floorplans`, { cache: "no-store" });
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

  const res = await fetch(`${API_BASE}/floorplans`, { method: "POST", body: formData });
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
    body: JSON.stringify({ building_id: buildingId, floor_name: floorName, image_url: imageUrl }),
  });
  const data = await handleJson<{ floorplan: FloorPlan }>(res);
  return data.floorplan;
}

export async function updateFloorPlan(
  floorplanId: number,
  buildingId: number,
  floorName: string,
  imageUrl: string
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

export async function deleteFloorPlan(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/floorplans/${id}`, { method: "DELETE" });
  await handleJson(res);
}


// ── Heatmap ────────────────────────────────────────────────────────────────────

export async function fetchFloorplanHeatmap(floorplanId: number): Promise<HeatmapPoint[]> {
  // No session_id needed anymore — just pass the floorplan
  const res = await fetch(`${API_BASE}/heatmap/floorplan/${floorplanId}`, { cache: "no-store" });
  return handleJson(res);
}