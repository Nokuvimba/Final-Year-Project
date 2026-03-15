import { API_BASE, handleJson } from "./http";
import type { WifiScan, ScanPoint, Device, ScanPointsResponse, DevicesResponse } from "./types";

// ─── Raw scan data ────────────────────────────────────────────────────────────

export async function fetchRecentScans(limit = 25): Promise<WifiScan[]> {
  const res = await fetch(
    `${API_BASE}/wifi/rawScans?limit=${limit}`,
    { cache: "no-store" }
  );
  const data = await handleJson<{ rows: WifiScan[] }>(res);
  return data.rows ?? [];
}

// ─── Scan points ──────────────────────────────────────────────────────────────
//
// A scan point is a physical (x, y) coordinate on a floor plan image.
// The admin clicks the map → a pin is created here.
// All sensor data from an assigned device is tagged with scan_point_id.

export async function fetchScanPoints(floorplanId: number): Promise<ScanPoint[]> {
  const res = await fetch(
    `${API_BASE}/floorplans/${floorplanId}/scan-points`,
    { cache: "no-store" }
  );
  const data = await handleJson<ScanPointsResponse>(res);
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
    body: JSON.stringify({ x, y, label }),
  });
  const data = await handleJson<{ scan_point: ScanPoint }>(res);
  return data.scan_point;
}

export async function updateScanPoint(
  pointId: number,
  fields: { label?: string; x?: number; y?: number }
): Promise<ScanPoint> {
  const res = await fetch(`${API_BASE}/scan-points/${pointId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const data = await handleJson<{ scan_point: ScanPoint }>(res);
  return data.scan_point;
}

export async function deleteScanPoint(pointId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/scan-points/${pointId}`, {
    method: "DELETE",
  });
  await handleJson(res);
}

// ─── Device management ────────────────────────────────────────────────────────
//
// A "device" is an ESP32 node. Its assignment lives directly on scan_point
// via the assigned_node column — there is no separate active_point table.
//
// GET /devices       → returns all scan_points where assigned_node IS NOT NULL
// assign-point       → sets scan_point.assigned_node = node
// clear-point        → sets scan_point.assigned_node = NULL

export async function fetchDevices(): Promise<Device[]> {
  const res = await fetch(`${API_BASE}/devices`, { cache: "no-store" });
  const data = await handleJson<DevicesResponse>(res);
  return data.devices ?? [];
}

export async function assignDeviceToPoint(
  node: string,
  scanPointId: number
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/devices/${encodeURIComponent(node)}/assign-point/${scanPointId}`,
    { method: "POST" }
  );
  await handleJson(res);
}

export async function clearDevicePoint(node: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/devices/${encodeURIComponent(node)}/clear-point`,
    { method: "POST" }
  );
  await handleJson(res);
}