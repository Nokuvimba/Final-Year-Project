// webapp/lib/api.ts
// Central place to talk to your FastAPI backend

//const API_BASE =
  //process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const isServer = typeof window === "undefined";

// Browser -> must use relative proxy (/api)
// Server   -> must use absolute URL 
const API_BASE = isServer
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api`
  : "/api";

// Helper to build correct image URLs
export function getImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http")) {
    return imageUrl;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return `${baseUrl}${imageUrl}`;
}
// ---------- Types ----------

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

  room_name?: string | null;
  building_id?: number | null;
  building_name?: string | null;
};

export type ScanSession = {
  id: number;
  node: string;
  room_id: number;
  room_name: string;
  building_id: number;
  building_name: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
};

export type FloorPlan = {
  id: number;
  floor_name: string;
  image_url: string;
  created_at: string;
  building_id?: number;
};

export type BuildingFloorPlans = {
  building: {
    id: number;
    name: string;
  };
  floorplans: FloorPlan[];
};

// Rows returned by /rooms/{room_id}/wifi
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

// Rows returned by /buildings/{building_id}/wifi
export type BuildingWifiRow = RoomWifiRow & {
  room_name: string;
};

// Return type for fetchRoomScans
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

// ---------- Helpers for dealing with HTTP errors ----------

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Request failed: ${res.status} ${res.statusText} ${text || ""}`.trim()
    );
  }
  return res.json() as Promise<T>;
}

// ---------- Buildings ----------

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

// ---------- Rooms ----------

export async function fetchRooms(
  buildingId?: number
): Promise<Room[]> {
  const hasValidBuildingId =
    typeof buildingId === "number" && Number.isFinite(buildingId);

  const url =
    buildingId != null
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
  roomId: number,
  payload: {
    name?: string;
    building_id?: number;
    floor?: string;
    room_type?: string;
  }
): Promise<Room> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ room: Room }>(res);
  return data.room;
}

export async function deleteRoom(roomId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed: ${res.status} ${text}`);
  }
}

// ---------- Raw recent scans ----------

export async function fetchRecentScans(
  limit = 25
): Promise<WifiScan[]> {
  const res = await fetch(
    `${API_BASE}/wifi/rawScans?limit=${limit}`,
    { cache: "no-store" }
  );
  const data = await handleJson<{ rows: WifiScan[] }>(res);
  return data.rows ?? [];
}

// ---------- Room / Building scans (session-based) ----------

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

// ---------- Scan sessions ----------

export async function fetchScanSessions(): Promise<ScanSession[]> {
  const res = await fetch(`${API_BASE}/sessions`, { cache: "no-store" });
  const data = await handleJson<{ sessions: ScanSession[] }>(res);
  return data.sessions ?? [];
}

// POST /rooms/{room_id}/start-scan
export async function startRoomScan(roomId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/start-scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}), // backend uses fixed node
  });

  await handleJson(res);
}

// POST /rooms/{room_id}/stop-scan
export async function stopRoomScan(roomId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/stop-scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}), // backend uses fixed node
  });

  await handleJson(res);
}

// ---------- Floor Plans ----------

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

export async function deleteFloorPlan(floorplanId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/floorplans/${floorplanId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed: ${res.status} ${text}`);
  }
}