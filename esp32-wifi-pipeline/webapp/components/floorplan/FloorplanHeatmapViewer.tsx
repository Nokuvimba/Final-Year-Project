"use client";

import { useEffect, useState } from "react";
import { fetchFloorplanHeatmap } from "@/lib/api";
import type { HeatmapPoint } from "@/lib/api";

interface Props {
  floorplanId: number;
  floorplanImageUrl: string;
  readOnly?: boolean;  // always true when used in AdminStudio view mode or User Viewer
}

const LEVEL_COLOR: Record<string, string> = {
  strong: "#22c55e",   // ≥ −50 dBm  green
  medium: "#3b82f6",   // −50 to −60  blue
  low:    "#f59e0b",   // −60 to −70  amber
  weak:   "#ef4444",   // < −70       red
};

const LEVEL_LABEL: Record<string, string> = {
  strong: "Strong ≥ −50 dBm",
  medium: "Medium −50 to −60",
  low:    "Low −60 to −70",
  weak:   "Weak < −70",
};

export default function FloorplanHeatmapViewer({ floorplanId, floorplanImageUrl }: Props) {
  const [points,  setPoints]  = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<HeatmapPoint | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchFloorplanHeatmap(floorplanId)
      .then(setPoints)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [floorplanId]);

  return (
    <div style={{ position: "relative", flex: 1, borderRadius: 10, overflow: "hidden", background: "#0a1628" }}>

      <img
        src={floorplanImageUrl}
        alt="Floor plan"
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />

      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#475569", fontSize: "0.82rem" }}>Loading signal data…</span>
        </div>
      )}

      {/* No data state */}
      {!loading && points.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: "rgba(15,25,41,0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.6rem 1.1rem", fontSize: "0.78rem", color: "#475569" }}>
            No scan data yet for this floor plan
          </div>
        </div>
      )}

      {/* Heatmap blobs */}
      {points.filter(pt => pt.x != null && pt.y != null).map(pt => {
        const color = pt.level ? LEVEL_COLOR[pt.level] : "#475569";
        return (
          <div
            key={pt.room_id}
            onMouseEnter={() => setTooltip(pt)}
            onMouseLeave={() => setTooltip(null)}
            style={{
              position: "absolute",
              left: `${pt.x! * 100}%`,
              top:  `${pt.y! * 100}%`,
              transform: "translate(-50%, -50%)",
              width: 40, height: 40,
              borderRadius: "50%",
              background: `${color}33`,
              border: `2px solid ${color}88`,
              boxShadow: `0 0 18px ${color}55`,
              cursor: "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
          </div>
        );
      })}

      {/* Hover tooltip */}
      {tooltip && tooltip.x != null && tooltip.y != null && (
        <div style={{
          position: "absolute",
          left: `${tooltip.x * 100}%`,
          top:  `${tooltip.y * 100}%`,
          transform: "translate(-50%, calc(-100% - 14px))",
          background: "rgba(15,25,41,0.96)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "0.45rem 0.75rem",
          fontSize: "0.72rem",
          color: "#e2e8f0",
          pointerEvents: "none",
          zIndex: 30,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{tooltip.room_name}</div>
          <div style={{ color: "#64748b" }}>
            RSSI: {tooltip.avg_rssi != null ? `${(tooltip.avg_rssi as number).toFixed(1)} dBm` : "—"}
            {" · "}
            {tooltip.samples} sample{tooltip.samples !== 1 ? "s" : ""}
          </div>
          {tooltip.level && (
            <div style={{ marginTop: 2, color: LEVEL_COLOR[tooltip.level] ?? "#64748b", fontWeight: 600 }}>
              {tooltip.level.charAt(0).toUpperCase() + tooltip.level.slice(1)} signal
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 12, right: 12,
        background: "rgba(15,25,41,0.88)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "0.5rem 0.75rem",
        display: "flex", flexDirection: "column", gap: 5,
      }}>
        {Object.entries(LEVEL_COLOR).map(([level, color]) => (
          <div key={level} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.64rem", color: "#64748b" }}>{LEVEL_LABEL[level]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}