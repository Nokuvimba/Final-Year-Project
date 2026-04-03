// lib/api.ts

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
  floor: string | null;
  room_type: string | null;
};

/**
 * A physical coordinate on a floor plan where an ESP32 sits.
 * label is display-only — has no connection to the Room table.
 */
export type ScanPoint = {
  id: number;
  floorplan_id: number;
  x: number;                   // 0.0 – 1.0
  y: number;                   // 0.0 – 1.0
  label: string | null;        // e.g. "Near window", "Lab bench 3"
  created_at: string;
  scan_count: number;          // how many wifi_scans are tagged to this point
  assigned_node: string | null; // which ESP32 is currently here (if any)
  is_active: boolean;
};

/**
 * An ESP32 device and the scan_point it is currently assigned to.
 * Replaces the old Device type which pointed to a room.
 */
export type Device = {
  node: string;
  scan_point_id: number | null;
  label: string | null;
  x: number | null;
  y: number | null;
  floorplan_id: number | null;
  assigned_at: string;
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
  building: { id: number; name: string };
  floorplans: FloorPlan[];
};

export type HeatmapPoint = {
  room_id: number;             // actually scan_point.id
  room_name: string;           // scan_point.label or "Point {id}"
  x: number | null;
  y: number | null;
  avg_rssi: number | null;
  level: "strong" | "medium" | "low" | "weak" | null;
  samples: number;
  assigned_node: string | null;
  last_scan_at: string | null; // ISO UTC timestamp of most recent scan at this point
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
  scan_point_id: number | null;
  label: string | null;
  x: number | null;
  y: number | null;
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
  scan_point_id: number | null;
};

export type RoomScanData = {
  room: { id: number; name: string; floor: string | null; room_type: string | null; building_id: number; building_name: string };
  rows: RoomWifiRow[];
};

export type BuildingWifiRow = WifiScan & { room_name?: string };


// ── HTTP helper ────────────────────────────────────────────────────────────────

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

export async function createBuilding(payload: { name: string; description?: string }): Promise<Building> {
  const res = await fetch(`${API_BASE}/buildings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ building: Building }>(res);
  return data.building;
}

export async function updateBuilding(id: number, payload: { name?: string; description?: string }): Promise<Building> {
  const res = await fetch(`${API_BASE}/buildings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ building: Building }>(res);
  return data.building;
}

export async function deleteBuilding(id: number): Promise<void> {
  await handleJson(await fetch(`${API_BASE}/buildings/${id}`, { method: "DELETE" }));
}


// ── Rooms (organisational only) ────────────────────────────────────────────────

export async function fetchRooms(buildingId?: number): Promise<Room[]> {
  const url = buildingId ? `${API_BASE}/rooms?building_id=${buildingId}` : `${API_BASE}/rooms`;
  const data = await handleJson<{ rooms: Room[] }>(await fetch(url, { cache: "no-store" }));
  return data.rooms ?? [];
}

export async function createRoom(payload: { name: string; building_id: number; floor?: string; room_type?: string }): Promise<Room> {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ room: Room }>(res);
  return data.room;
}

export async function updateRoom(id: number, payload: { name?: string; floor?: string; room_type?: string }): Promise<Room> {
  const res = await fetch(`${API_BASE}/rooms/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ room: Room }>(res);
  return data.room;
}

export async function deleteRoom(id: number): Promise<void> {
  await handleJson(await fetch(`${API_BASE}/rooms/${id}`, { method: "DELETE" }));
}


// ── Scan Points ────────────────────────────────────────────────────────────────

export async function fetchScanPoints(floorplanId: number): Promise<ScanPoint[]> {
  const res = await fetch(`${API_BASE}/floorplans/${floorplanId}/scan-points`, { cache: "no-store" });
  const data = await handleJson<{ scan_points: ScanPoint[] }>(res);
  return data.scan_points ?? [];
}

export async function createScanPoint(
  floorplanId: number,
  x: number,
  y: number,
  label?: string
): Promise<ScanPoint> {
  const res = await fetch(`${API_BASE}/floorplans/${floorplanId}/scan-points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y, label: label ?? null }),
  });
  const data = await handleJson<{ scan_point: ScanPoint }>(res);
  return data.scan_point;
}

export async function updateScanPoint(
  pointId: number,
  payload: { label?: string; x?: number; y?: number }
): Promise<ScanPoint> {
  const res = await fetch(`${API_BASE}/scan-points/${pointId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ scan_point: ScanPoint }>(res);
  return data.scan_point;
}

export async function deleteScanPoint(pointId: number): Promise<void> {
  await handleJson(await fetch(`${API_BASE}/scan-points/${pointId}`, { method: "DELETE" }));
}


// ── Devices ────────────────────────────────────────────────────────────────────

export async function fetchDevices(): Promise<Device[]> {
  const res = await fetch(`${API_BASE}/devices`, { cache: "no-store" });
  const data = await handleJson<{ devices: Device[] }>(res);
  return data.devices ?? [];
}

export async function assignDeviceToPoint(node: string, scanPointId: number): Promise<Device> {
  const res = await fetch(
    `${API_BASE}/devices/${encodeURIComponent(node)}/assign-point/${scanPointId}`,
    { method: "POST" }
  );
  return handleJson<Device>(res);
}

export async function clearDevicePoint(node: string): Promise<void> {
  await handleJson(
    await fetch(`${API_BASE}/devices/${encodeURIComponent(node)}/clear-point`, { method: "POST" })
  );
}


// ── Scans ──────────────────────────────────────────────────────────────────────

export async function fetchRecentScans(limit = 25): Promise<WifiScan[]> {
  const res = await fetch(`${API_BASE}/wifi/rawScans?limit=${limit}`, { cache: "no-store" });
  const data = await handleJson<{ rows: WifiScan[] }>(res);
  return data.rows ?? [];
}


// ── Floor Plans ────────────────────────────────────────────────────────────────

export async function fetchBuildingFloorPlans(buildingId: number): Promise<BuildingFloorPlans> {
  return handleJson(await fetch(`${API_BASE}/buildings/${buildingId}/floorplans`, { cache: "no-store" }));
}

export async function uploadFloorPlan(buildingId: number, floorName: string, file: File): Promise<FloorPlan> {
  const formData = new FormData();
  formData.append("building_id", buildingId.toString());
  formData.append("floor_name", floorName);
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/floorplans`, { method: "POST", body: formData });
  const data = await handleJson<{ floorplan: FloorPlan }>(res);
  return data.floorplan;
}

export async function createFloorPlanFromUrl(buildingId: number, floorName: string, imageUrl: string): Promise<FloorPlan> {
  const res = await fetch(`${API_BASE}/floorplans/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ building_id: buildingId, floor_name: floorName, image_url: imageUrl }),
  });
  const data = await handleJson<{ floorplan: FloorPlan }>(res);
  return data.floorplan;
}

export async function updateFloorPlan(floorplanId: number, buildingId: number, floorName: string, imageUrl: string): Promise<FloorPlan> {
  const res = await fetch(`${API_BASE}/floorplans/${floorplanId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ building_id: buildingId, floor_name: floorName, image_url: imageUrl }),
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
  // Note: no session_id needed — queries scan_point directly
  const res = await fetch(`${API_BASE}/heatmap/floorplan/${floorplanId}`, { cache: "no-store" });
  return handleJson(res);
}


// ── Floor Plan — Replace Image ─────────────────────────────────────────────────
// Replaces the image file for an existing floor plan.
// Scan points are preserved — their (x, y) coordinates remain unchanged.
// The old image file is deleted from disk automatically by the backend.

export async function replaceFloorPlanImage(floorplanId: number, file: File): Promise<FloorPlan> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/floorplans/${floorplanId}/image`, {
    method: "PUT",
    body: formData,
  });
  const data = await handleJson<{ floorplan: FloorPlan }>(res);
  return data.floorplan;
}


// ── Devices — Known Nodes ──────────────────────────────────────────────────────
// Returns all node names ever seen — both currently assigned nodes AND any node
// that has ever sent data to /ingest. Used to populate the device assignment
// dropdown in the admin studio so a new ESP32 appears as soon as it sends its
// first scan, before any manual assignment is made.

export async function fetchKnownNodes(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/devices/known`, { cache: "no-store" });
  const data = await handleJson<{ nodes: string[] }>(res);
  return data.nodes ?? [];
}


// ── WiFi Signal History ────────────────────────────────────────────────────────
// Returns scan activity bucketed by minute for a specific scan point.
// Used by the signal trend bar chart in the sensor card (admin studio + user viewer).
//
// minute_ago : 0 = most recent minute, 19 = oldest
// count      : wifi_scan rows received that minute — the "busyness" value
//              One ESP32 scan cycle produces ~10–20 rows (one per SSID found)
// avg_rssi   : average signal strength across all rows in that minute
// level      : strong / medium / low / weak — derived from avg_rssi

export type SignalLevel = "strong" | "medium" | "low" | "weak" | null;

// range: "20m" | "1h" | "6h" | "24h" | "7d"
// Bucket sizes per range:
//   20m → 1-min buckets (20)  |  1h → 1-min buckets (60)
//   6h  → 10-min buckets (36) |  24h → 1-hr buckets (24)
//   7d  → 6-hr buckets (28)
// label: human-readable period label e.g. "19m", "5h", "3d"
// count: scan rows that arrived in that period (busyness indicator)

export type TimeRange = "20m" | "1h" | "6h" | "24h" | "7d";

export type WifiHistoryBucket = {
  label: string;           // e.g. "19m", "5h", "3d" — oldest end of bucket
  bucket_start: string;    // ISO UTC timestamp for the start of this bucket
  count: number;           // scan rows received — the busyness value
  avg_rssi: number | null; // null when count is 0
  level: SignalLevel;
};

export type WifiHistoryResponse = {
  scan_point_id: number;
  label: string | null;
  range: TimeRange;
  bucket_minutes: number;
  n_buckets: number;
  total_scans: number;
  buckets: WifiHistoryBucket[];
};

export async function fetchWifiHistory(
  scanPointId: number,
  range: TimeRange = "20m"
): Promise<WifiHistoryBucket[]> {
  const res = await fetch(
    `${API_BASE}/scan-points/${scanPointId}/wifi-history?time_range=${range}`,
    { cache: "no-store" }
  );
  const data = await handleJson<WifiHistoryResponse>(res);
  return data.buckets ?? [];
}

// ─── Temperature / Humidity ───────────────────────────────────────────────────

export type Dht22Reading = {
  received_at:   string;   // ISO UTC timestamp
  temperature_c: number;   // degrees Celsius
  humidity_pct:  number;   // relative humidity %
};

export type TemperatureHistoryResponse = {
  scan_point_id: number;
  time_range:    string;
  count:         number;
  readings:      Dht22Reading[];
};

export async function fetchDht22History(
  scanPointId: number,
  time_range: string = "24h"
): Promise<Dht22Reading[]> {
  const res = await fetch(
    `${API_BASE}/scan-points/${scanPointId}/dht22-history?time_range=${time_range}`,
    { cache: "no-store" }
  );
  const data = await handleJson<TemperatureHistoryResponse>(res);
  return data.readings ?? [];
}