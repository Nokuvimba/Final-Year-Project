"use client";

import { useEffect, useState, useRef } from "react";
import { fetchFloorplanHeatmap } from "@/lib/api";
import type { HeatmapPoint } from "@/lib/api";

interface Props {
  floorplanId: number;
  floorplanImageUrl: string;
  readOnly?: boolean;
}

const LEVEL_COLOR: Record<string, string> = {
  strong: "#22c55e",
  medium: "#3b82f6",
  low:    "#f59e0b",
  weak:   "#ef4444",
};

const LEVEL_LABEL: Record<string, string> = {
  strong: "Strong ≥ −50 dBm",
  medium: "Medium −50 to −60",
  low:    "Low −60 to −70",
  weak:   "Weak < −70",
};

export default function FloorplanHeatmapViewer({ floorplanId, floorplanImageUrl }: Props) {
  const [points,      setPoints]      = useState<HeatmapPoint[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activePoint, setActivePoint] = useState<HeatmapPoint | null>(null);
  const [cardPos,     setCardPos]     = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setActivePoint(null);
    fetchFloorplanHeatmap(floorplanId)
      .then(setPoints)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [floorplanId]);

  // Click outside card closes it
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-sensor-card]") && !target.closest("[data-blob]")) {
        setActivePoint(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleBlobClick(e: React.MouseEvent, pt: HeatmapPoint) {
    e.stopPropagation();
    if (activePoint?.room_id === pt.room_id) {
      setActivePoint(null);
      return;
    }
    const container = containerRef.current;
    if (container && pt.x != null && pt.y != null) {
      const rect = container.getBoundingClientRect();
      const blobX = pt.x * rect.width;
      const blobY = pt.y * rect.height;
      const cardLeft = Math.min(blobX + 16, rect.width - 260);
      const cardTop  = Math.max(blobY - 230, 8);
      setCardPos({ top: cardTop, left: cardLeft });
    }
    setActivePoint(pt);
  }

  const signalColor = activePoint?.level ? LEVEL_COLOR[activePoint.level] : "#475569";

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", flex: 1, borderRadius: 10, overflow: "hidden", background: "#0a1628" }}
    >
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

      {!loading && points.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: "rgba(15,25,41,0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.6rem 1.1rem", fontSize: "0.78rem", color: "#475569" }}>
            No scan data yet for this floor plan
          </div>
        </div>
      )}

      {/* Heatmap blobs */}
      {points.filter(pt => pt.x != null && pt.y != null).map(pt => {
        const color    = pt.level ? LEVEL_COLOR[pt.level] : "#475569";
        const isActive = activePoint?.room_id === pt.room_id;
        return (
          <div
            key={pt.room_id}
            data-blob
            onClick={e => handleBlobClick(e, pt)}
            style={{
              position: "absolute",
              left: `${pt.x! * 100}%`,
              top:  `${pt.y! * 100}%`,
              transform: "translate(-50%, -50%)",
              width:  isActive ? 52 : 40,
              height: isActive ? 52 : 40,
              borderRadius: "50%",
              background: `${color}${isActive ? "44" : "28"}`,
              borderWidth: 2,
              borderStyle: "solid",
              borderColor: `${color}${isActive ? "cc" : "77"}`,
              boxShadow: isActive ? `0 0 28px ${color}88` : `0 0 14px ${color}44`,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.18s",
              zIndex: isActive ? 20 : 10,
            }}
          >
            <div style={{ width: isActive ? 10 : 8, height: isActive ? 10 : 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, transition: "all 0.18s" }} />
          </div>
        );
      })}

      {/* Sensor detail card (click-to-show) */}
      {activePoint && cardPos && (
        <div
          data-sensor-card
          style={{
            position: "absolute",
            top: cardPos.top,
            left: cardPos.left,
            width: 240,
            background: "rgba(13,22,38,0.97)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            zIndex: 40,
            overflow: "hidden",
            animation: "fadeInCard 0.18s ease",
          }}
        >
          {/* Card header */}
          <div style={{ padding: "0.875rem 1rem 0.6rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#f1f5f9" }}>{activePoint.room_name}</span>
              <button
                onClick={() => setActivePoint(null)}
                style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 0 }}>
                ×
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: signalColor, boxShadow: `0 0 6px ${signalColor}` }} />
              <span style={{ fontSize: "0.7rem", color: signalColor, fontWeight: 600, textTransform: "capitalize" }}>
                {activePoint.level ?? "No signal data"}
              </span>
            </div>
          </div>

          {/* Sensor rows */}
          <div style={{ padding: "0.5rem 0" }}>
            <SensorRow
              icon="📶"
              label="WiFi Signal"
              value={activePoint.avg_rssi != null ? `${(activePoint.avg_rssi as number).toFixed(1)} dBm` : "—"}
              sub={`${activePoint.samples} sample${activePoint.samples !== 1 ? "s" : ""}`}
              color={signalColor}
            />
            <SensorRow icon="🌡️" label="Temperature" value="—" sub="DHT22 · pending" color="#f97316" pending />
            <SensorRow icon="💧" label="Humidity"    value="—" sub="DHT22 · pending" color="#06b6d4" pending />
            <SensorRow icon="🌿" label="Air Quality" value="—" sub="MQ135 · pending" color="#10b981" pending />

            <div style={{ margin: "0.4rem 1rem", borderTop: "1px solid rgba(255,255,255,0.06)" }} />

            {/* Device status */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.35rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{ fontSize: "0.8rem" }}>🔌</span>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Device Status</span>
              </div>
              {activePoint.assigned_node ? (
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#22c55e" }}>Online</span>
              ) : (
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>Unassigned</span>
              )}
            </div>
            {activePoint.assigned_node && (
              <div style={{ padding: "0 1rem 0.35rem", fontSize: "0.68rem", color: "#334155", fontFamily: "monospace" }}>
                {activePoint.assigned_node}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(15,25,41,0.88)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: 5 }}>
        {Object.entries(LEVEL_COLOR).map(([level, color]) => (
          <div key={level} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.64rem", color: "#64748b" }}>{LEVEL_LABEL[level]}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 3, paddingTop: 5, fontSize: "0.62rem", color: "#334155" }}>
          Click a point for details
        </div>
      </div>

      <style>{`
        @keyframes fadeInCard {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function SensorRow({ icon, label, value, sub, color, pending = false }: {
  icon: string; label: string; value: string; sub: string; color: string; pending?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.35rem 1rem", opacity: pending ? 0.45 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <span style={{ fontSize: "0.8rem" }}>{icon}</span>
        <div>
          <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{label}</div>
          <div style={{ fontSize: "0.64rem", color: "#334155" }}>{sub}</div>
        </div>
      </div>
      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: pending ? "#475569" : color, fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  );
}
