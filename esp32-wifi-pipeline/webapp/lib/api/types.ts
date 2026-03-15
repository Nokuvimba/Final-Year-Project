// lib/api/types.ts
// Central type definitions for the MSSIA platform.
// All lib/api/*.ts files import from here — never from each other.

// ─── Buildings ────────────────────────────────────────────────────────────────

export type Building = {
  id: number;
  name: string;
  description: string | null;
};

// ─── Rooms ────────────────────────────────────────────────────────────────────
// Rooms are display-only organisational units.
// They are NOT connected to scan data — scans are tagged via scan_point.

export type Room = {
  id: number;
  name: string;
  floor: string | null;
  room_type: string | null;
  building_id: number;
};

// ─── Floor plans ──────────────────────────────────────────────────────────────

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

// ─── Scan points ──────────────────────────────────────────────────────────────
// A scan point is a physical (x, y) coordinate on a floor plan image.
// The admin clicks the map → a pin drops here.
// All sensor readings from an assigned device are tagged with scan_point_id.
//
// assigned_node — which ESP32 is currently here (was a separate active_point
//                 table, now a column directly on scan_point — Migration 4).

export type ScanPoint = {
  id: number;
  floorplan_id: number;
  x: number;                    // 0.0–1.0 fraction of image width
  y: number;                    // 0.0–1.0 fraction of image height
  label: string | null;         // e.g. "Lab bench 3", "Near window"
  assigned_node: string | null; // ESP32 node id currently here
  assigned_at: string | null;   // when device was last assigned
  is_active: boolean;           // true if assigned_node is set
  scan_count: number;           // how many wifi_scan rows tagged to this point
  created_at: string;
};

export type ScanPointsResponse = {
  floorplan_id: number;
  scan_points: ScanPoint[];
};

// ─── Devices ──────────────────────────────────────────────────────────────────
// A device is an ESP32 node currently assigned to a scan point.
// GET /devices returns scan_points WHERE assigned_node IS NOT NULL.
// There is no separate devices table — assignment lives on scan_point.

export type Device = {
  node: string;
  scan_point_id: number;
  label: string | null;
  x: number;
  y: number;
  floorplan_id: number;
  assigned_at: string;
  is_active: true;
};

export type DevicesResponse = {
  devices: Device[];
};

// ─── WiFi scans ───────────────────────────────────────────────────────────────

export type WifiScan = {
  id: number;
  received_at: string;
  node: string;
  ssid: string | null;
  bssid: string | null;
  rssi: number | null;
  channel: number | null;
  enc: string | null;
  scan_point_id: number | null;
  label: string | null;         // from scan_point.label
  x: number | null;
  y: number | null;
};

// ─── Heatmap ──────────────────────────────────────────────────────────────────

export type SignalLevel = "strong" | "medium" | "low" | "weak" | null;

export type HeatmapPoint = {
  room_id: number;              // scan_point.id (field reused for compat)
  room_name: string;            // scan_point.label or "Point {id}"
  x: number;
  y: number;
  avg_rssi: number | null;
  level: SignalLevel;
  samples: number;
};

// ─── Legacy — kept for type compatibility only, not used in new pages ─────────
// These types supported the old session/room scan flows.
// They can be removed once all old pages are deleted.

export type RoomScanData = {
  room_id: number;
  room_name: string;
  scans: WifiScan[];
};

export type BuildingWifiRow = WifiScan & { room_name?: string };