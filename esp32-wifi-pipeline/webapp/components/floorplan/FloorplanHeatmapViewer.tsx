"use client";

import { useEffect, useState, useRef } from "react";
import { fetchFloorplanHeatmap } from "@/lib/api";
import type { HeatmapPoint, WifiHistoryBucket } from "@/lib/api";

interface Props {
  floorplanId: number;
  floorplanImageUrl: string;
  readOnly?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

// ─── WiFi history fetch ───────────────────────────────────────────────────────

async function fetchWifiHistory(pointId: number, minutes = 20): Promise<WifiHistoryBucket[]> {
  const res = await fetch(
    `${API_BASE}/scan-points/${pointId}/wifi-history?minutes=${minutes}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.buckets ?? [];
}

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════

export default function FloorplanHeatmapViewer({ floorplanId, floorplanImageUrl }: Props) {
  const [points,      setPoints]      = useState<HeatmapPoint[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activePoint, setActivePoint] = useState<HeatmapPoint | null>(null);
  const [cardPos,     setCardPos]     = useState<{ top: number; left: number } | null>(null);
  const [chartOpen,   setChartOpen]   = useState(false);
  const [chartData,   setChartData]   = useState<WifiHistoryBucket[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setActivePoint(null);
    setChartOpen(false);
    fetchFloorplanHeatmap(floorplanId)
      .then(setPoints)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [floorplanId]);

  // Close card on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-sensor-card]") && !target.closest("[data-blob]")) {
        setActivePoint(null);
        setChartOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleBlobClick(e: React.MouseEvent, pt: HeatmapPoint) {
    e.stopPropagation();
    if (activePoint?.room_id === pt.room_id) {
      setActivePoint(null);
      setChartOpen(false);
      return;
    }
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const blobX = (pt.x ?? 0) * rect.width;
      const blobY = (pt.y ?? 0) * rect.height;
      // Card is 260px wide — prefer right of blob, clamp to container
      const cardLeft = Math.min(blobX + 18, rect.width - 276);
      const cardTop  = Math.max(blobY - 60, 8);
      setCardPos({ top: cardTop, left: cardLeft });
    }
    setActivePoint(pt);
    setChartOpen(false);
    setChartData([]);
  }

  async function handleWifiSignalClick() {
    if (!activePoint) return;
    if (chartOpen) { setChartOpen(false); return; }
    setChartLoading(true);
    setChartOpen(true);
    try {
      const data = await fetchWifiHistory(activePoint.room_id, 20);
      setChartData(data);
    } catch (e) { console.error(e); }
    finally { setChartLoading(false); }
  }

  const signalColor = activePoint?.level ? LEVEL_COLOR[activePoint.level] : "#475569";

  // ── Render ─────────────────────────────────────────────────────────────────
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
      {points.map(pt => {
        if (pt.x == null || pt.y == null) return null;
        const color    = pt.level ? LEVEL_COLOR[pt.level] : "#475569";
        const isActive = activePoint?.room_id === pt.room_id;
        return (
          <div
            key={pt.room_id}
            data-blob
            onClick={e => handleBlobClick(e, pt)}
            style={{
              position: "absolute",
              left: `${pt.x * 100}%`,
              top:  `${pt.y * 100}%`,
              transform: "translate(-50%, -50%)",
              width:  isActive ? 52 : 40,
              height: isActive ? 52 : 40,
              borderRadius: "50%",
              background: `${color}${isActive ? "44" : "28"}`,
              borderWidth: 2, borderStyle: "solid", borderColor: `${color}${isActive ? "cc" : "77"}`,
              boxShadow: isActive ? `0 0 28px ${color}88` : `0 0 14px ${color}44`,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.18s",
              zIndex: isActive ? 20 : 10,
            }}
          >
            <div style={{
              width: isActive ? 10 : 8, height: isActive ? 10 : 8,
              borderRadius: "50%", background: color,
              boxShadow: `0 0 8px ${color}`, transition: "all 0.18s",
            }} />
          </div>
        );
      })}

      {/* ── Sensor card ── */}
      {activePoint && cardPos && (
        <div
          data-sensor-card
          style={{
            position: "absolute",
            top: cardPos.top,
            left: cardPos.left,
            width: 260,
            background: "rgba(13,22,38,0.97)",
            borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.12)",
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
              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#f1f5f9" }}>{activePoint.room_name}</span>
              <button onClick={() => { setActivePoint(null); setChartOpen(false); }}
                style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: signalColor, boxShadow: `0 0 6px ${signalColor}` }} />
              <span style={{ fontSize: "0.7rem", color: signalColor, fontWeight: 600, textTransform: "capitalize" }}>
                {activePoint.level ?? "No signal data"}
              </span>
            </div>
          </div>

          {/* Sensor rows */}
          <div style={{ padding: "0.4rem 0" }}>

            {/* WiFi Signal — clickable, expands chart */}
            <button
              onClick={handleWifiSignalClick}
              style={{
                width: "100%", background: chartOpen ? "rgba(59,130,246,0.08)" : "none",
                border: "none", cursor: "pointer", padding: "0.35rem 1rem",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "background 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{ fontSize: "0.8rem" }}>📶</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>WiFi Signal</div>
                  <div style={{ fontSize: "0.64rem", color: "#334155" }}>
                    {activePoint.samples} sample{activePoint.samples !== 1 ? "s" : ""} · click for trend
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: signalColor, fontFamily: "monospace" }}>
                  {activePoint.avg_rssi != null ? `${(activePoint.avg_rssi as number).toFixed(1)} dBm` : "—"}
                </span>
                <span style={{ fontSize: "0.65rem", color: "#475569", transition: "transform 0.2s", display: "inline-block", transform: chartOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
              </div>
            </button>

            {/* Signal trend chart — expands inline */}
            {chartOpen && (
              <div style={{ padding: "0 0.875rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.05)", animation: "expandChart 0.2s ease" }}>
                {chartLoading ? (
                  <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "#475569" }}>Loading trend…</span>
                  </div>
                ) : (
                  <SignalTrendChart data={chartData} color={signalColor} />
                )}
              </div>
            )}

            {/* Temperature */}
            <SensorRow icon="🌡️" label="Temperature" value="—" sub="DHT22 · pending" color="#f97316" pending />
            {/* Humidity */}
            <SensorRow icon="💧" label="Humidity" value="—" sub="DHT22 · pending" color="#06b6d4" pending />
            {/* Air Quality */}
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
      <div style={{
        position: "absolute", bottom: 12, right: 12,
        background: "rgba(15,25,41,0.88)",
        borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "0.5rem 0.75rem",
        display: "flex", flexDirection: "column", gap: 5,
      }}>
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
        @keyframes expandChart {
          from { opacity: 0; transform: scaleY(0.85); transform-origin: top; }
          to   { opacity: 1; transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Signal Trend Chart — SVG sparkline, no external library needed
// ═════════════════════════════════════════════════════════════════════════════
// Signal History — raw scan rows matching /wifi/rawScans shape
// ═════════════════════════════════════════════════════════════════════════════
// Signal Trend Chart
// Bar chart: height = busyness (scan count), bar colour = signal level
// Each bar = one 1-minute bucket over the last 20 minutes
// ═════════════════════════════════════════════════════════════════════════════

const LEVEL_COLOR_MAP: Record<string, string> = {
  strong: "#22c55e",
  medium: "#3b82f6",
  low:    "#f59e0b",
  weak:   "#ef4444",
};

function SignalTrendChart({ data, color }: { data: WifiHistoryBucket[]; color: string }) {
  const [hovered, setHovered] = useState<WifiHistoryBucket | null>(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "0.7rem", color: "#334155" }}>No data in last 20 minutes</span>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const BAR_H    = 56;   // max bar height in px
  const GAP      = 2;    // gap between bars
  const barW     = Math.max(1, Math.floor((228 - data.length * GAP) / data.length));

  // Show every 4th x-label to avoid crowding
  const xLabels = data.filter((_, i) => i % 4 === 0 || i === data.length - 1);

  return (
    <div style={{ marginTop: "0.5rem" }}>
      {/* Chart title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: "0.65rem", color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Signal Trend · last 20 min
        </span>
        <span style={{ fontSize: "0.62rem", color: "#334155" }}>bar height = scan activity</span>
      </div>

      {/* Bar chart */}
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: `${GAP}px`, height: BAR_H + 18 }}>
        {data.map((bucket, i) => {
          const barHeight = bucket.count === 0 ? 2 : Math.max(4, Math.round((bucket.count / maxCount) * BAR_H));
          const barColor  = bucket.level ? LEVEL_COLOR_MAP[bucket.level] : "#1e3a5f";
          const isHovered = hovered === bucket;

          return (
            <div
              key={i}
              onMouseEnter={() => setHovered(bucket)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: 1,
              }}
            >
              {/* Bar */}
              <div style={{
                width: "100%",
                height: barHeight,
                background: bucket.count === 0
                  ? "rgba(255,255,255,0.04)"
                  : isHovered ? `${barColor}ff` : `${barColor}bb`,
                borderRadius: "2px 2px 0 0",
                transition: "height 0.2s ease, background 0.15s",
                marginTop: BAR_H - barHeight,
              }} />

              {/* X-axis label every 4th bar */}
              {(i % 4 === 0 || i === data.length - 1) && (
                <span style={{
                  fontSize: 7,
                  color: "#334155",
                  fontFamily: "monospace",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                }}>
                  {bucket.minute_ago}m
                </span>
              )}
            </div>
          );
        })}

        {/* Hover tooltip */}
        {hovered && (
          <div style={{
            position: "absolute",
            bottom: BAR_H + 6,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(13,22,38,0.97)",
            borderWidth: 1, borderStyle: "solid",
            borderColor: hovered.level ? `${LEVEL_COLOR_MAP[hovered.level]}66` : "rgba(255,255,255,0.12)",
            borderRadius: 7,
            padding: "0.3rem 0.55rem",
            fontSize: "0.68rem",
            color: "#e2e8f0",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 50,
            boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
              {hovered.level && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: LEVEL_COLOR_MAP[hovered.level],
                  display: "inline-block", flexShrink: 0,
                }} />
              )}
              <span style={{ fontWeight: 700, color: hovered.level ? LEVEL_COLOR_MAP[hovered.level] : "#475569", textTransform: "capitalize" }}>
                {hovered.level ?? "No signal"}
              </span>
              <span style={{ color: "#334155" }}>·</span>
              <span style={{ color: "#64748b" }}>{hovered.minute_ago}m ago</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span>
                <span style={{ color: "#475569" }}>scans: </span>
                <span style={{ fontWeight: 700, color: "#94a3b8" }}>{hovered.count}</span>
              </span>
              {hovered.avg_rssi != null && (
                <span>
                  <span style={{ color: "#475569" }}>RSSI: </span>
                  <span style={{ fontWeight: 700, color: hovered.level ? LEVEL_COLOR_MAP[hovered.level] : "#94a3b8" }}>
                    {hovered.avg_rssi} dBm
                  </span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Colour legend */}
      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        {Object.entries(LEVEL_COLOR_MAP).map(([level, c]) => (
          <div key={level} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: 1, background: c }} />
            <span style={{ fontSize: "0.6rem", color: "#334155", textTransform: "capitalize" }}>{level}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: 1, background: "rgba(255,255,255,0.04)", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)" }} />
          <span style={{ fontSize: "0.6rem", color: "#334155" }}>no data</span>
        </div>
      </div>
    </div>
  );
}

// ─── Sensor row sub-component ─────────────────────────────────────────────────

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
      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: pending ? "#475569" : color, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}