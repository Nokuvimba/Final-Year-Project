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

export type BuildingWifiRow = RoomWifiRow & {
  room_name: string;
};

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
