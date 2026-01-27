"use client";

import { useState, useEffect } from "react";
import { fetchBuildingFloorPlans, type BuildingFloorPlans, type FloorPlan } from "../../../../../lib/api";

interface FloorPlansPageProps {
  params: {
    buildingId: string;
  };
}

export default function FloorPlansPage({ params }: FloorPlansPageProps) {
  const [data, setData] = useState<BuildingFloorPlans | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlan | null>(null);

  const buildingId = parseInt(params.buildingId);

  useEffect(() => {
    async function loadFloorPlans() {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching floor plans for building ID:', buildingId);
        const result = await fetchBuildingFloorPlans(buildingId);
        console.log('Floor plans result:', result);
        setData(result);
        
        // Default to first floor plan if available
        if (result.floorplans.length > 0) {
          setSelectedFloorPlan(result.floorplans[0]);
        }
      } catch (err) {
        console.error('Error loading floor plans:', err);
        setError(err instanceof Error ? err.message : "Failed to load floor plans");
      } finally {
        setLoading(false);
      }
    }

    if (!isNaN(buildingId)) {
      loadFloorPlans();
    } else {
      setError("Invalid building ID");
      setLoading(false);
    }
  }, [buildingId]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading floor plans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!data || data.floorplans.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">
          Floor Plans - {data?.building.name || "Building"}
        </h1>
        <div className="text-gray-600">No floor plans available for this building.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Floor Plans - {data.building.name}
      </h1>

      {/* Floor Selection */}
      {data.floorplans.length > 1 && (
        <div className="mb-6">
          <label htmlFor="floor-select" className="block text-sm font-medium mb-2">
            Select Floor:
          </label>
          <select
            id="floor-select"
            value={selectedFloorPlan?.id || ""}
            onChange={(e) => {
              const floorPlan = data.floorplans.find(fp => fp.id === parseInt(e.target.value));
              setSelectedFloorPlan(floorPlan || null);
            }}
            className="border border-gray-300 rounded px-3 py-2"
          >
            {data.floorplans.map((fp) => (
              <option key={fp.id} value={fp.id}>
                {fp.floor_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Floor Plan Display */}
      {selectedFloorPlan && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {selectedFloorPlan.floor_name}
          </h2>
          <div className="max-w-4xl">
            <img
              src={selectedFloorPlan.image_url}
              alt={`Floor plan for ${selectedFloorPlan.floor_name}`}
              className="w-full h-auto border border-gray-300 rounded shadow-lg"
              style={{ maxWidth: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}