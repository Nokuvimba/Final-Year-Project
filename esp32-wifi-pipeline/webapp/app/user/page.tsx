"use client";

// app/user/page.tsx
// Public-facing read-only signal map viewer.
// Light theme matching Figma design — white background, sensor filter tabs,
// building search, floor tabs, and right side panel on point click.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchBuildings,
  fetchBuildingFloorPlans,
  type Building,
  type FloorPlan,
} from "@/lib/api";
import UserHeatmapViewer from "@/components/floorplan/UserHeatmapViewer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

export default function UserViewerPage() {
  const [buildings,         setBuildings]         = useState<Building[]>([]);
  const [selectedBuilding,  setSelectedBuilding]  = useState<Building | null>(null);
  const [floorplans,        setFloorplans]        = useState<FloorPlan[]>([]);
  const [selectedFloorplan, setSelectedFloorplan] = useState<FloorPlan | null>(null);
  const [loadingBuildings,  setLoadingBuildings]  = useState(true);
  const [loadingFloors,     setLoadingFloors]     = useState(false);
  const [searchQuery,       setSearchQuery]       = useState("");
  const [showDropdown,      setShowDropdown]      = useState(false);
  useEffect(() => {
    fetchBuildings()
      .then(setBuildings)
      .catch(console.error)
      .finally(() => setLoadingBuildings(false));
  }, []);

  async function selectBuilding(b: Building) {
    setSelectedBuilding(b);
    setSelectedFloorplan(null);
    setFloorplans([]);
    setShowDropdown(false);
    setSearchQuery(b.name);
    setLoadingFloors(true);
    try {
      const data = await fetchBuildingFloorPlans(b.id);
      const fps  = data.floorplans ?? [];
      setFloorplans(fps);
      if (fps.length > 0) setSelectedFloorplan(fps[0]);
    } catch (e) { console.error(e); }
    finally { setLoadingFloors(false); }
  }

  const filtered = buildings.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{
      height: "100vh",
      overflow: "hidden",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>

      {/* Top bar */}
      <header style={{
        display: "flex", alignItems: "center", gap: "1rem",
        padding: "0 1.25rem", height: 56,
        background: "#ffffff", borderBottom: "1px solid #e5e7eb",
        flexShrink: 0, position: "sticky", top: 0, zIndex: 30,
      }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: "#fff", opacity: 0.9 }} />
          </div>
          <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#111827" }}>Multi-Sensor Analytics</span>
        </Link>

        {/* Building search */}
        <div style={{ position: "relative", flex: 1, maxWidth: 440 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: "0.82rem", pointerEvents: "none" }}>🔍</span>
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Search building or address"
            disabled={loadingBuildings}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: 24, padding: "0.4rem 0.875rem 0.4rem 2rem",
              color: "#111827", fontSize: "0.84rem", outline: "none",
            }}
          />
          {showDropdown && filtered.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "#ffffff", border: "1px solid #e5e7eb",
              borderRadius: 12, zIndex: 50, maxHeight: 220, overflowY: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            }}>
              {filtered.map(b => (
                <button key={b.id} onMouseDown={() => selectBuilding(b)}
                  style={{
                    width: "100%", background: selectedBuilding?.id === b.id ? "#eff6ff" : "none",
                    border: "none", borderBottom: "1px solid #f9fafb",
                    color: "#111827", padding: "0.6rem 1rem",
                    textAlign: "left", cursor: "pointer", fontSize: "0.84rem",
                  }}>
                  <span style={{ fontWeight: 500 }}>{b.name}</span>
                  {b.description && <span style={{ display: "block", fontSize: "0.72rem", color: "#9ca3af", marginTop: 1 }}>{b.description}</span>}
                </button>
              ))}
            </div>
          )}
        </div>


      </header>

      {/* Floor tabs */}
      {floorplans.length > 1 && (
        <div style={{
          display: "flex", gap: 4, padding: "0.5rem 1.25rem",
          background: "#ffffff", borderBottom: "1px solid #f3f4f6",
          overflowX: "auto", flexShrink: 0,
        }}>
          {floorplans.map(fp => (
            <button key={fp.id} onClick={() => setSelectedFloorplan(fp)}
              style={{
                padding: "0.28rem 0.875rem", borderRadius: 7,
                borderWidth: 1, borderStyle: "solid",
                borderColor: selectedFloorplan?.id === fp.id ? "#2563eb" : "#e5e7eb",
                background: selectedFloorplan?.id === fp.id ? "#eff6ff" : "#ffffff",
                color: selectedFloorplan?.id === fp.id ? "#1d4ed8" : "#6b7280",
                fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
              }}>
              {fp.floor_name}
            </button>
          ))}
        </div>
      )}

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>

        {/* Empty state */}
        {!selectedBuilding && !loadingBuildings && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", padding: "2rem", background: "#f9fafb" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>📡</div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", margin: "0 0 0.4rem" }}>Select a building to view signal data</p>
              <p style={{ fontSize: "0.82rem", color: "#9ca3af", margin: 0 }}>Search for a building above or select one below</p>
            </div>
            {buildings.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center", maxWidth: 500 }}>
                {buildings.map(b => (
                  <button key={b.id} onClick={() => selectBuilding(b)}
                    style={{
                      background: "#ffffff", border: "1px solid #e5e7eb",
                      borderRadius: 10, padding: "0.6rem 1.1rem",
                      color: "#374151", fontSize: "0.82rem", fontWeight: 500,
                      cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.color = "#1d4ed8"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#374151"; }}
                  >{b.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {loadingFloors && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
            <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>Loading floor plan…</span>
          </div>
        )}

        {selectedBuilding && !loadingFloors && floorplans.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "#f9fafb" }}>
            <span style={{ fontSize: "2rem" }}>🗺️</span>
            <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: 0 }}>
              No floor plans uploaded for <strong style={{ color: "#374151" }}>{selectedBuilding.name}</strong> yet
            </p>
          </div>
        )}

        {/* Heatmap canvas — fills full remaining space like admin studio */}
        {selectedFloorplan && !loadingFloors && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
            <UserHeatmapViewer
              floorplanId={selectedFloorplan.id}
              floorplanImageUrl={getImageUrl(selectedFloorplan.image_url)}
              buildingName={selectedBuilding?.name ?? ""}
              floorName={selectedFloorplan.floor_name}
            />
          </div>
        )}
      </main>
    </div>
  );
}