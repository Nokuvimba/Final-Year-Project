export { API_BASE, handleJson, getImageUrl } from "./http";

export type {
  Building,
  Room,
  WifiScan,
  FloorPlan,
  BuildingFloorPlans,
  HeatmapPoint,
  BuildingWifiRow,
  RoomScanData,
  ScanPoint,
  ScanPointsResponse,
  Device,
  DevicesResponse,
} from "./types";

export {
  fetchBuildings,
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from "./buildings";

export {
  fetchRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomPosition,
} from "./rooms";

export {
  fetchRecentScans,
  fetchScanPoints,
  createScanPoint,
  updateScanPoint,
  deleteScanPoint,
  fetchDevices,
  assignDeviceToPoint,
  clearDevicePoint,
  fetchKnownNodes,
} from "./scans";

export {
  fetchBuildingFloorPlans,
  uploadFloorPlan,
  createFloorPlanFromUrl,
  updateFloorPlan,
  deleteFloorPlan,
} from "./floorplans";

export { fetchFloorplanHeatmap } from "./heatmap";

export {
  fetchWifiHistory,
  fetchDht22History,
} from "./dht22";

export type { TimeRange, Dht22Reading } from "./dht22";

export { fetchDht22Heatmap } from "./dht22";
export type { Dht22HeatmapPoint } from "./dht22";
