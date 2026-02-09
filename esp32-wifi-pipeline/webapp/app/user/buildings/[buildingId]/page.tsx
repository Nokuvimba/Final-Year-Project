// app/user/buildings/[buildingId]/page.tsx
"use client";

import { fetchBuildingFloorPlans, type FloorPlan } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import FloorplanHeatmapViewer from "@/components/floorplan/FloorplanHeatmapViewer";

type Props = {
  params: Promise<{ buildingId: string }>;
};

export default function UserBuildingPage({ params }: Props) {
  const resolvedParams = use(params);
  const buildingId = Number(resolvedParams.buildingId);
  const router = useRouter();
  
  const [data, setData] = useState<{ building: { id: number; name: string }; floorplans: FloorPlan[] } | null>(null);
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, [buildingId]);

  async function loadData() {
    try {
      const result = await fetchBuildingFloorPlans(buildingId);
      setData(result);
      if (result.floorplans.length > 0) {
        setSelectedFloorPlan(result.floorplans[0]);
      }
    } catch (err) {
      console.error('Failed to load floor plans:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleRoomClick(roomId: number) {
    router.push(`/user/buildings/${buildingId}/rooms/${roomId}`);
  }
  
  if (loading) return <div className="page">Loading...</div>;

  if (!data) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Building not found</h2>
          <Link href="/user" className="button button-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link href="/user" className="link-back">← Back to Dashboard</Link>
          <h1 className="page-title">{data.building.name}</h1>
        </div>
      </header>

      {data.floorplans.length === 0 ? (
        <div className="empty-state">
          <h2>No floor plans available</h2>
          <p>Floor plans have not been uploaded for this building yet.</p>
        </div>
      ) : (
        <>
          {/* Floor Selection */}
          {data.floorplans.length > 1 && (
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="floor-select" className="form-label">
                Select Floor:
              </label>
              <select
                id="floor-select"
                value={selectedFloorPlan?.id || ""}
                onChange={(e) => {
                  const floorPlan = data.floorplans.find(fp => fp.id === parseInt(e.target.value));
                  setSelectedFloorPlan(floorPlan || null);
                }}
                className="input"
                style={{ maxWidth: '300px' }}
              >
                {data.floorplans.map((fp) => (
                  <option key={fp.id} value={fp.id}>
                    {fp.floor_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Floorplan Heatmap */}
          {selectedFloorPlan && (
            <div>
              <h2 style={{ marginBottom: '16px' }}>{selectedFloorPlan.floor_name}</h2>
              <FloorplanHeatmapViewer
                floorplanId={selectedFloorPlan.id}
                floorplanImageUrl={selectedFloorPlan.image_url}
                readOnly={true}
                onRoomClick={handleRoomClick}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}