"use client";

import { useEffect, useState } from "react";
import FloorplanHeatmapViewer from "@/components/floorplan/FloorplanHeatmapViewer";
import { fetchBuildings, fetchBuildingFloorPlans, fetchRoomScans, getImageUrl, type Building, type FloorPlan, type RoomWifiRow } from "@/lib/api";

export default function AdminStudioClient() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [floorplan, setFloorplan] = useState<FloorPlan | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomScans, setRoomScans] = useState<RoomWifiRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBuildings() {
      try {
        const data = await fetchBuildings();
        setBuildings(data);
        if (data.length > 0) {
          await selectBuilding(data[0]);
        }
      } catch (err) {
        console.error("Failed to load buildings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBuildings();
  }, []);

  async function selectBuilding(building: Building) {
    setSelectedBuilding(building);
    setSelectedRoomId(null);
    setRoomScans([]);
    try {
      const floorplansData = await fetchBuildingFloorPlans(building.id);
      if (floorplansData.floorplans.length > 0) {
        setFloorplan(floorplansData.floorplans[0]);
      } else {
        setFloorplan(null);
      }
    } catch (err) {
      console.error("Failed to load floorplans:", err);
      setFloorplan(null);
    }
  }

  async function handleRoomClick(roomId: number) {
    setSelectedRoomId(roomId);
    try {
      const data = await fetchRoomScans(roomId, 100);
      setRoomScans(data.rows);
    } catch (err) {
      console.error("Failed to load room scans:", err);
      setRoomScans([]);
    }
  }

  const filteredBuildings = buildings.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <div className="h-screen bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600" />
          <div>
            <div className="font-semibold leading-tight">Map Studio</div>
            <div className="text-xs text-slate-400 leading-tight">
              Admin workflow — floorplan → rooms → scans
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              className="h-9 w-[420px] rounded-lg bg-white/5 border border-white/10 px-3 text-sm outline-none focus:border-blue-500"
              placeholder="Search address or building..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && filteredBuildings.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-slate-900 border border-white/10 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                {filteredBuildings.map(building => (
                  <button
                    key={building.id}
                    onClick={() => {
                      selectBuilding(building);
                      setSearchQuery("");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm"
                  >
                    <div className="font-medium">{building.name}</div>
                    {building.description && (
                      <div className="text-xs text-slate-400">{building.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10">
            Admin
          </span>
        </div>
      </div>

      {/* Main */}
      <div className="h-[calc(100vh-3.5rem)] grid grid-cols-[1fr_420px]">
        {/* Map area */}
        <div className="p-4">
          <div className="h-full rounded-xl border border-white/10 bg-black/20 overflow-hidden">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-sm text-slate-300">
                {selectedBuilding ? selectedBuilding.name : "No building selected"}
                {floorplan && ` - ${floorplan.floor_name}`}
              </div>
              <div className="text-xs text-slate-400">
                Selected room:{" "}
                {selectedRoomId !== null ? `#${selectedRoomId}` : "None"}
              </div>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="text-slate-400 text-center py-8">Loading...</div>
              ) : !floorplan ? (
                <div className="text-slate-400 text-center py-8">
                  No floorplan available for this building.
                  <br />
                  <span className="text-xs">Upload a floorplan to get started.</span>
                </div>
              ) : (
                <FloorplanHeatmapViewer
                  floorplanId={floorplan.id}
                  floorplanImageUrl={getImageUrl(floorplan.image_url)}
                  readOnly={true}
                  onRoomClick={handleRoomClick}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="border-l border-white/10 bg-slate-950 p-4">
          <div className="rounded-xl border border-white/10 bg-white/5 h-full overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="font-semibold">Room Details</div>
                <div className="text-xs text-slate-400">
                  Click a room on the map to see scans.
                </div>
              </div>

              {selectedRoomId !== null && (
                <button
                  onClick={() => setSelectedRoomId(null)}
                  className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  Close
                </button>
              )}
            </div>

            <div className="p-4 text-sm text-slate-300 overflow-y-auto" style={{ maxHeight: "calc(100vh - 10rem)" }}>
              {selectedRoomId === null ? (
                <div className="text-slate-400">
                  No room selected yet. Click a heat marker/room on the floorplan.
                </div>
              ) : (
                <div>
                  <div className="mb-3">
                    <div className="text-xs text-slate-400">Selected Room</div>
                    <div className="text-lg font-semibold">
                      Room #{selectedRoomId}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 mb-3">
                    <div className="text-xs text-slate-400 mb-2">
                      Wi-Fi Scans ({roomScans.length})
                    </div>
                    {roomScans.length === 0 ? (
                      <div className="text-slate-400 text-xs">No scans available for this room.</div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {roomScans.slice(0, 20).map(scan => (
                          <div key={scan.id} className="text-xs border-b border-white/5 pb-2">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-slate-200">{scan.ssid || "Hidden"}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                (scan.rssi ?? -100) >= -50 ? "bg-green-500/20 text-green-400" :
                                (scan.rssi ?? -100) >= -70 ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-red-500/20 text-red-400"
                              }`}>
                                {scan.rssi} dBm
                              </span>
                            </div>
                            <div className="text-slate-500 font-mono text-[10px]">
                              {scan.bssid} • Ch {scan.channel}
                            </div>
                            <div className="text-slate-500 text-[10px]">
                              {new Date(scan.received_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom status */}
          <div className="mt-3 text-xs text-slate-400 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Device Connected • Last scan: 2 minutes ago
          </div>
        </div>
      </div>
    </div>
  );
}
