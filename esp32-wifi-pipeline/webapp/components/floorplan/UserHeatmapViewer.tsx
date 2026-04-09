"use client";

// components/floorplan/UserHeatmapViewer.tsx
// Light-themed heatmap viewer for the public user interface.
// Click a blob → right side panel slides in with Overview / Signal / Temp / Humidity / Air tabs.
// Mode switcher (Signal | Temp | Humidity | Air) changes blob colours across the whole map.

import { useEffect, useState, useRef } from "react";
import { fetchFloorplanHeatmap, fetchWifiHistory, fetchDht22History, fetchDht22Heatmap, fetchMq135History, fetchMq135Heatmap } from "@/lib/api";
import type { HeatmapPoint, WifiHistoryBucket, TimeRange, Dht22Reading, Dht22HeatmapPoint, Mq135Reading, Mq135HeatmapPoint } from "@/lib/api";

// ── Timestamp helpers ─────────────────────────────────────────────────────────

function formatTimestamp(iso: string | null): string {
  if (!iso) return "No data";
  const d = new Date(iso);
  const day  = d.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return `${day}, ${time}`;
}

function formatBucketTime(iso: string | null, range: TimeRange): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (range === "7d") return d.toLocaleDateString("en-IE", { day: "2-digit", month: "short" });
  return d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatXAxisLabel(iso: string | null, range: TimeRange): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (range === "7d") return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric" });
  return d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ── Signal level config ───────────────────────────────────────────────────────

const LEVEL: Record<string, { color: string; label: string }> = {
  strong: { color: "#3b82f6", label: "Strong" },
  medium: { color: "#f59e0b", label: "Med"    },
  low:    { color: "#f97316", label: "Low"    },
  weak:   { color: "#ef4444", label: "High"   },
};

// ── Heatmap mode config ───────────────────────────────────────────────────────

type HeatmapMode = "signal" | "temp" | "humidity" | "air";

// Temperature colour scale (°C): Cool < 16 | Comfortable 16–21 | Warm > 21
const TEMP_LEVEL: Record<string, { color: string; label: string }> = {
  cool: { color: "#3b82f6", label: "Cool" },
  warm: { color: "#f59e0b", label: "Warm" },
  hot:  { color: "#ef4444", label: "Hot"  },
};

// Humidity colour scale (%): Low < 30 | Med 30–60 | High > 60
// Light lavender → medium indigo → deep violet (dryer = lighter, wetter = deeper)
const HUMIDITY_LEVEL: Record<string, { color: string; label: string }> = {
  low:    { color: "#a5b4fc", label: "Low"  },
  medium: { color: "#818cf8", label: "Med"  },
  high:   { color: "#6d28d9", label: "High" },
};

// Air quality colour scale (raw ADC at 3.3V): Good < 2000 | Moderate 2000–2800 | Poor > 2800
const AIR_LEVEL: Record<string, { color: string; label: string }> = {
  good:     { color: "#22c55e", label: "Good"     },
  moderate: { color: "#f59e0b", label: "Moderate" },
  poor:     { color: "#ef4444", label: "Poor"     },
};

const MODE_CONFIG: Record<HeatmapMode, { icon: string; label: string; activeColor: string; activeBg: string }> = {
  signal:   { icon: "📶", label: "Signal",   activeColor: "#fff", activeBg: "#2563eb" },
  temp:     { icon: "🌡️", label: "Temp",     activeColor: "#fff", activeBg: "#dc2626" },
  humidity: { icon: "💧", label: "Humidity", activeColor: "#fff", activeBg: "#7c3aed" },
  air:      { icon: "🌿", label: "Air",      activeColor: "#fff", activeBg: "#16a34a" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "signal" | "temp" | "humidity" | "air";

type TokenMap = ReturnType<typeof buildTokens>;
function buildTokens(dark: boolean) {
  return dark ? {
    panelBg:"rgba(13,22,38,0.97)",panelBorder:"rgba(255,255,255,0.08)",
    headerBorder:"rgba(255,255,255,0.07)",titleColor:"#f1f5f9",subColor:"#64748b",
    closeColor:"#475569",tabActiveBg:"rgba(255,255,255,0.08)",tabActiveCol:"#f1f5f9",
    tabInactiveCol:"#475569",h3Color:"#e2e8f0",
    rangeBtnActive:"rgba(59,130,246,0.25)",rangeBtnActiveBorder:"rgba(59,130,246,0.5)",
    rangeBtnActiveCol:"#60a5fa",rangeBtnBg:"rgba(255,255,255,0.06)",rangeBtnCol:"#475569",
    listBorder:"rgba(255,255,255,0.06)",listRowBg:"rgba(255,255,255,0.02)",
    listRowBorder:"rgba(255,255,255,0.04)",listLabelCol:"#94a3b8",pendingCol:"#334155",
    deviceCol:"#475569",gridLinCol:"rgba(255,255,255,0.06)",
    tooltipBg:"rgba(13,22,38,0.97)",tooltipBorder:"rgba(255,255,255,0.12)",
    tooltipCol:"#e2e8f0",tooltipSubCol:"#64748b",
    metricBg:"rgba(255,255,255,0.04)",metricBorder:"rgba(255,255,255,0.06)",
    pendingSensorBg:"rgba(255,255,255,0.03)",legendBg:"rgba(10,18,32,0.88)",
    legendBorder:"rgba(255,255,255,0.08)",legendLabelCol:"#64748b",legendTitleCol:"#94a3b8",
    mapBg:"#080f1e",zoomBg:"rgba(13,22,38,0.88)",zoomBorder:"rgba(255,255,255,0.1)",zoomCol:"#94a3b8",
    modeSwitcherBg:"rgba(13,22,38,0.95)",modeSwitcherBorder:"rgba(255,255,255,0.08)",
    modeInactiveBg:"rgba(255,255,255,0.06)",
  } : {
    panelBg:"#ffffff",panelBorder:"#e5e7eb",headerBorder:"#f3f4f6",
    titleColor:"#111827",subColor:"#6b7280",closeColor:"#9ca3af",
    tabActiveBg:"#f3f4f6",tabActiveCol:"#111827",tabInactiveCol:"#9ca3af",h3Color:"#111827",
    rangeBtnActive:"#2563eb",rangeBtnActiveBorder:"#2563eb",rangeBtnActiveCol:"#ffffff",
    rangeBtnBg:"#f3f4f6",rangeBtnCol:"#6b7280",
    listBorder:"#f3f4f6",listRowBg:"#ffffff",listRowBorder:"#f9fafb",
    listLabelCol:"#374151",pendingCol:"#d1d5db",deviceCol:"#9ca3af",
    gridLinCol:"#f3f4f6",tooltipBg:"rgba(255,255,255,0.97)",tooltipBorder:"#e5e7eb",
    tooltipCol:"#374151",tooltipSubCol:"#6b7280",
    metricBg:"#f9fafb",metricBorder:"#f3f4f6",pendingSensorBg:"#ffffff",
    legendBg:"rgba(255,255,255,0.92)",legendBorder:"transparent",
    legendLabelCol:"#6b7280",legendTitleCol:"#374151",
    mapBg:"#f0f4f8",zoomBg:"rgba(255,255,255,0.9)",zoomBorder:"rgba(0,0,0,0.1)",zoomCol:"#374151",
    modeSwitcherBg:"rgba(255,255,255,0.96)",modeSwitcherBorder:"#e5e7eb",
    modeInactiveBg:"#f3f4f6",
  };
}

interface Props {
  floorplanId: number;
  floorplanImageUrl: string;
  buildingName?: string;
  floorName?: string;
  dark?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════

export default function UserHeatmapViewer({
  floorplanId,
  floorplanImageUrl,
  buildingName = "",
  floorName = "",
  dark = false,
}: Props) {
  const T = buildTokens(dark);

  // ── State ──────────────────────────────────────────────────────────────────
  const [points,       setPoints]       = useState<HeatmapPoint[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activePoint,  setActivePoint]  = useState<HeatmapPoint | null>(null);
  const [activeTab,    setActiveTab]    = useState<Tab>("overview");
  const [history,      setHistory]      = useState<WifiHistoryBucket[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [chartRange,   setChartRange]   = useState<TimeRange>("20m");
  const [tempHistory,  setTempHistory]  = useState<Dht22Reading[]>([]);
  const [tempLoading,  setTempLoading]  = useState(false);
  const [tempRange,    setTempRange]    = useState<string>("24h");
  // ── Heatmap mode ──────────────────────────────────────────────────────────
  const [heatmapMode,  setHeatmapMode]  = useState<HeatmapMode>("signal");
  const [dht22Points,  setDht22Points]  = useState<Dht22HeatmapPoint[]>([]);
  const [dht22Loading, setDht22Loading] = useState(false);
  // ── MQ-135 air quality ────────────────────────────────────────────────────
  const [mq135Points,   setMq135Points]   = useState<Mq135HeatmapPoint[]>([]);
  const [mq135Loading,  setMq135Loading]  = useState(false);
  const [mq135History,  setMq135History]  = useState<Mq135Reading[]>([]);
  const [mq135AirLoad,  setMq135AirLoad]  = useState(false);
  const [mq135Range,    setMq135Range]    = useState<string>("24h");

  const containerRef = useRef<HTMLDivElement>(null);

  // Derive last scan time from fresh history (not stale heatmap data)
  const lastScanAt: string | null = history.length > 0
    ? (() => {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].count > 0 && history[i].bucket_start) return history[i].bucket_start;
        }
        return activePoint?.last_scan_at ?? null;
      })()
    : activePoint?.last_scan_at ?? null;

  // ── Effects ───────────────────────────────────────────────────────────────

  // Load signal heatmap on floor plan change
  useEffect(() => {
    setLoading(true);
    setActivePoint(null);
    fetchFloorplanHeatmap(floorplanId)
      .then(setPoints)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [floorplanId]);

  // Load WiFi history when point selected or range changes
  useEffect(() => {
    if (!activePoint) return;
    setHistLoading(true);
    fetchWifiHistory(activePoint.room_id, chartRange)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setHistLoading(false));
  }, [activePoint?.room_id, chartRange]);

  // Load DHT22 history when point selected or temp range changes
  useEffect(() => {
    if (!activePoint) return;
    setTempLoading(true);
    fetchDht22History(activePoint.room_id, tempRange)
      .then(setTempHistory)
      .catch(console.error)
      .finally(() => setTempLoading(false));
  }, [activePoint?.room_id, tempRange]);

  // Load DHT22 heatmap data when mode switches to temp or humidity
  useEffect(() => {
    if (heatmapMode !== "temp" && heatmapMode !== "humidity") return;
    setDht22Loading(true);
    fetchDht22Heatmap(floorplanId)
      .then(setDht22Points)
      .catch(console.error)
      .finally(() => setDht22Loading(false));
  }, [floorplanId, heatmapMode]);

  // Load MQ-135 heatmap data when mode switches to air
  useEffect(() => {
    if (heatmapMode !== "air") return;
    setMq135Loading(true);
    fetchMq135Heatmap(floorplanId)
      .then(setMq135Points)
      .catch(console.error)
      .finally(() => setMq135Loading(false));
  }, [floorplanId, heatmapMode]);

  // Load MQ-135 history when a point is selected or mq135Range changes
  useEffect(() => {
    if (!activePoint) return;
    setMq135AirLoad(true);
    fetchMq135History(activePoint.room_id, mq135Range)
      .then(setMq135History)
      .catch(console.error)
      .finally(() => setMq135AirLoad(false));
  }, [activePoint?.room_id, mq135Range]);

  // ── Blob colour based on mode ─────────────────────────────────────────────

  function getBlobColor(pt: HeatmapPoint): string {
    if (heatmapMode === "temp" || heatmapMode === "humidity") {
      const d22 = dht22Points.find(p => p.scan_point_id === pt.room_id);
      if (heatmapMode === "temp") {
        const lvl = d22?.temp_level;
        return lvl ? TEMP_LEVEL[lvl].color : "#d1d5db";
      }
      const lvl = d22?.humidity_level;
      return lvl ? HUMIDITY_LEVEL[lvl].color : "#d1d5db";
    }
    if (heatmapMode === "air") {
      const mq = mq135Points.find(p => p.scan_point_id === pt.room_id);
      const lvl = mq?.air_level;
      return lvl ? AIR_LEVEL[lvl].color : "#d1d5db";
    }
    // signal (default)
    const cfg = pt.level ? LEVEL[pt.level] : null;
    return cfg?.color ?? "#94a3b8";
  }

  function handleBlobClick(pt: HeatmapPoint) {
    if (activePoint?.room_id === pt.room_id) { setActivePoint(null); return; }
    setActivePoint(pt);
    setActiveTab("overview");
  }

  const signalColor = activePoint?.level ? (LEVEL[activePoint.level]?.color ?? "#94a3b8") : "#94a3b8";

  // ── Legend config per mode ─────────────────────────────────────────────────

  const LEGENDS: Record<HeatmapMode, { title: string; items: { label: string; color: string }[] }> = {
    signal:   { title: "Signal Density", items: [{ label: "Low", color: "#3b82f6" }, { label: "Med", color: "#f59e0b" }, { label: "High", color: "#ef4444" }] },
    temp:     { title: "Temperature",    items: [{ label: "Cool <16°C", color: "#3b82f6" }, { label: "~16–21°C", color: "#f59e0b" }, { label: "Warm >21°C", color: "#ef4444" }] },
    humidity: { title: "Humidity",       items: [{ label: "Low", color: "#a5b4fc" }, { label: "Med", color: "#818cf8" }, { label: "High", color: "#6d28d9" }] },
    air:      { title: "Air Quality",    items: [{ label: "Good", color: "#22c55e" }, { label: "Mod", color: "#84cc16" }, { label: "Poor", color: "#ef4444" }] },
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: 0 }}>

      {/* ── Mode switcher bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0.5rem 1rem", gap: "0.5rem", flexShrink: 0,
        background: T.modeSwitcherBg,
        borderBottom: `1px solid ${T.modeSwitcherBorder}`,
      }}>
        {(["signal", "temp", "humidity", "air"] as HeatmapMode[]).map(mode => {
          const cfg = MODE_CONFIG[mode];
          const isActive = heatmapMode === mode;
          return (
            <button
              key={mode}
              onClick={() => { setHeatmapMode(mode); setActivePoint(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "0.35rem",
                padding: "0.4rem 0.875rem", borderRadius: 20, border: "none",
                background: isActive ? cfg.activeBg : T.modeInactiveBg,
                color: isActive ? cfg.activeColor : T.tabInactiveCol,
                fontSize: "0.78rem", fontWeight: isActive ? 700 : 500,
                cursor: "pointer", transition: "all 0.18s",
                boxShadow: isActive ? `0 2px 8px ${cfg.activeBg}66` : "none",
              }}
            >
              <span style={{ fontSize: "0.82rem" }}>{cfg.icon}</span>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ── Map + panel row ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>

        {/* ── Map area ── */}
        <div
          ref={containerRef}
          style={{ flex: 1, position: "relative", overflow: "hidden", background: T.mapBg, transition: "flex 0.3s ease" }}
          onClick={() => setActivePoint(null)}
        >
          <img
            src={floorplanImageUrl}
            alt="Floor plan"
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />

          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>Loading signal data…</span>
            </div>
          )}

          {/* Heatmap blobs */}
          {!loading && points.map(pt => {
            if (pt.x == null || pt.y == null) return null;
            const color    = getBlobColor(pt);
            const isActive = activePoint?.room_id === pt.room_id;
            return (
              <div
                key={pt.room_id}
                onClick={e => { e.stopPropagation(); handleBlobClick(pt); }}
                style={{
                  position: "absolute",
                  left: `${pt.x * 100}%`,
                  top:  `${pt.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: isActive ? 80 : 64,
                  height: isActive ? 80 : 64,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${color}55 0%, ${color}22 50%, transparent 70%)`,
                  boxShadow: isActive
                    ? `0 0 40px 20px ${color}55, 0 0 80px 40px ${color}22`
                    : `0 0 30px 15px ${color}44, 0 0 60px 30px ${color}18`,
                  cursor: "pointer", transition: "all 0.2s ease",
                  zIndex: isActive ? 10 : 5,
                }}
              />
            );
          })}

          {/* Mode-aware legend — top right */}
          {(() => {
            const leg = LEGENDS[heatmapMode];
            return (
              <div style={{
                position: "absolute", top: 12, right: 12,
                background: T.legendBg, borderRadius: 10,
                padding: "0.5rem 0.75rem", boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: T.legendTitleCol, marginBottom: 2 }}>{leg.title}</span>
                <div style={{ display: "flex", gap: 10 }}>
                  {leg.items.map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
                      <span style={{ fontSize: "0.68rem", color: T.legendLabelCol }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Zoom controls */}
          <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            {["⊕", "⊖", "⛶"].map((icon, i) => (
              <button key={i} style={{
                width: 32, height: 32, borderRadius: 6, background: T.zoomBg,
                border: "1px solid", borderColor: T.zoomBorder,
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)", cursor: "pointer",
                fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", color: T.zoomCol,
              }}>{icon}</button>
            ))}
          </div>

          {!loading && points.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 10, padding: "0.6rem 1.1rem", fontSize: "0.78rem", color: T.closeColor }}>
                No scan data for this floor plan yet
              </div>
            </div>
          )}
        </div>

        {/* ── Right side panel ── */}
        {activePoint && (
          <div style={{
            width: 340, flexShrink: 0, background: T.panelBg,
            borderLeft: `1px solid ${T.panelBorder}`,
            display: "flex", flexDirection: "column",
            animation: "slideInPanel 0.25s ease", overflow: "hidden",
          }}>
            {/* Panel header */}
            <div style={{ padding: "1.25rem 1.25rem 0", borderBottom: "1px solid #f3f4f6", paddingBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: T.titleColor }}>{activePoint.room_name}</h2>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: T.subColor }}>
                    {floorName}{buildingName ? ` · ${buildingName}` : ""}
                  </p>
                </div>
                <button onClick={() => setActivePoint(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1.2rem", lineHeight: 1, padding: "0.1rem", marginTop: 2 }}>×</button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 2, marginTop: "1rem" }}>
                {(["overview", "signal", "temp", "humidity", "air"] as Tab[]).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    flex: 1, padding: "0.35rem 0", borderRadius: 6, border: "none",
                    background: activeTab === tab ? T.tabActiveBg : "none",
                    color: activeTab === tab ? T.tabActiveCol : T.tabInactiveCol,
                    fontSize: "0.72rem", fontWeight: activeTab === tab ? 700 : 500,
                    cursor: "pointer", transition: "all 0.15s", textTransform: "capitalize",
                  }}>
                    {tab === "overview" ? "Overview" : tab === "signal" ? "Signal" : tab === "temp" ? "Temp" : tab === "humidity" ? "Humidity" : "Air"}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>

              {/* Overview tab */}
              {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    <MetricCard icon="📶" iconBg="#eff6ff" iconColor="#2563eb"
                      label="Wi-Fi APs" labelColor="#2563eb"
                      value={String(activePoint.samples)} valueColor="#1d4ed8" tokens={T} />
                    <MetricCard icon="≋" iconBg="#ecfdf5" iconColor="#059669"
                      label="Avg RSSI" labelColor="#059669"
                      value={activePoint.avg_rssi != null ? `${(activePoint.avg_rssi as number).toFixed(0)} dBm` : "—"}
                      valueColor="#065f46" tokens={T} />
                  </div>

                  {/* Sensor rows */}
                  <div style={{ borderRadius: 10, border: `1px solid ${T.listBorder}`, overflow: "hidden" }}>
                    {/* Temperature */}
                    {(() => {
                      const latest = tempHistory.length > 0 ? tempHistory[tempHistory.length - 1] : null;
                      return (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.55rem 0.875rem", borderBottom: `1px solid ${T.listRowBorder}`, background: T.listRowBg }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ width: 26, height: 26, borderRadius: 6, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem" }}>🌡️</div>
                            <span style={{ fontSize: "0.78rem", color: T.listLabelCol }}>Temperature</span>
                          </div>
                          {tempLoading ? <span style={{ fontSize: "0.72rem", color: T.pendingCol }}>Loading…</span>
                            : latest ? <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ea580c", fontFamily: "monospace" }}>{latest.temperature_c.toFixed(1)} °C</span>
                            : <span style={{ fontSize: "0.72rem", color: T.pendingCol, fontStyle: "italic" }}>pending</span>}
                        </div>
                      );
                    })()}
                    {/* Humidity */}
                    {(() => {
                      const latest = tempHistory.length > 0 ? tempHistory[tempHistory.length - 1] : null;
                      return (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.55rem 0.875rem", borderBottom: `1px solid ${T.listRowBorder}`, background: T.listRowBg }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ width: 26, height: 26, borderRadius: 6, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem" }}>💧</div>
                            <span style={{ fontSize: "0.78rem", color: T.listLabelCol }}>Humidity</span>
                          </div>
                          {tempLoading ? <span style={{ fontSize: "0.72rem", color: T.pendingCol }}>Loading…</span>
                            : latest ? <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#7c3aed", fontFamily: "monospace" }}>{latest.humidity_pct.toFixed(1)} %</span>
                            : <span style={{ fontSize: "0.72rem", color: T.pendingCol, fontStyle: "italic" }}>pending</span>}
                        </div>
                      );
                    })()}
                    {/* Air Quality */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.55rem 0.875rem", background: T.listRowBg }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem" }}>🌿</div>
                        <span style={{ fontSize: "0.78rem", color: T.listLabelCol }}>Air Quality</span>
                      </div>
                      {mq135AirLoad ? (
                        <span style={{ fontSize: "0.72rem", color: T.pendingCol }}>Loading…</span>
                      ) : mq135History.length > 0 ? (() => {
                        const latestAir = mq135History[mq135History.length - 1];
                        const airLabel = latestAir.raw_value < 2000 ? "Good" : latestAir.raw_value < 2800 ? "Moderate" : "Poor";
                        const airColor = airLabel === "Good" ? "#22c55e" : airLabel === "Moderate" ? "#f59e0b" : "#ef4444";
                        return <span style={{ fontSize: "0.82rem", fontWeight: 700, color: airColor, fontFamily: "monospace" }}>{airLabel}</span>;
                      })() : (
                        <span style={{ fontSize: "0.72rem", color: T.pendingCol, fontStyle: "italic" }}>pending</span>
                      )}
                    </div>
                  </div>

                  {/* Device + last scan */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.78rem" }}>🔌</span>
                      <span style={{ fontSize: "0.72rem", color: T.deviceCol }}>
                        {activePoint.assigned_node ? `Device: ${activePoint.assigned_node}` : "No device assigned"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.78rem" }}>🕐</span>
                      <span style={{ fontSize: "0.72rem", color: T.deviceCol }}>
                        {lastScanAt ? `Last scan: ${formatTimestamp(lastScanAt)}`
                          : histLoading ? "Loading…" : "No scans recorded yet"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Signal tab */}
              {activeTab === "signal" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                    <h3 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: T.h3Color }}>Signal Trend</h3>
                    <div style={{ display: "flex", gap: 3 }}>
                      {(["20m","1h","6h","24h","7d"] as TimeRange[]).map(r => (
                        <button key={r} onClick={() => setChartRange(r)} style={{
                          background: chartRange === r ? T.rangeBtnActive : T.rangeBtnBg,
                          border: "none", borderRadius: 5,
                          color: chartRange === r ? T.rangeBtnActiveCol : T.rangeBtnCol,
                          fontSize: "0.68rem", fontWeight: 600, padding: "0.2rem 0.45rem", cursor: "pointer",
                        }}>{r}</button>
                      ))}
                    </div>
                  </div>
                  {histLoading ? (
                    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>Loading…</span>
                    </div>
                  ) : (
                    <LightLineChart data={history} color="#06b6d4" yKey="count"
                      tooltipLabel="signals" yAxisLabel="" tokens={T} chartRange={chartRange} />
                  )}
                </div>
              )}

              {/* Temp tab */}
              {activeTab === "temp" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                    <h3 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: T.h3Color }}>Temperature History</h3>
                    <div style={{ display: "flex", gap: 3 }}>
                      {(["1h","6h","24h","7d"] as string[]).map(r => (
                        <button key={r} onClick={() => setTempRange(r)} style={{
                          background: tempRange === r ? T.rangeBtnActive : T.rangeBtnBg,
                          border: "none", borderRadius: 5,
                          color: tempRange === r ? T.rangeBtnActiveCol : T.rangeBtnCol,
                          fontSize: "0.68rem", fontWeight: 600, padding: "0.2rem 0.45rem", cursor: "pointer",
                        }}>{r}</button>
                      ))}
                    </div>
                  </div>
                  {tempLoading ? (
                    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "0.78rem", color: T.pendingCol }}>Loading…</span>
                    </div>
                  ) : tempHistory.length > 0 ? (
                    <TempLineChart data={tempHistory} color="#f97316" yKey="temperature_c" unit="°C" tokens={T} />
                  ) : (
                    <PendingChart color="#f97316" label="No temperature data yet — DHT22 wired to GPIO 4" tokens={T} />
                  )}
                </div>
              )}

              {/* Humidity tab */}
              {activeTab === "humidity" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                    <h3 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: T.h3Color }}>Humidity History</h3>
                    <div style={{ display: "flex", gap: 3 }}>
                      {(["1h","6h","24h","7d"] as string[]).map(r => (
                        <button key={r} onClick={() => setTempRange(r)} style={{
                          background: tempRange === r ? T.rangeBtnActive : T.rangeBtnBg,
                          border: "none", borderRadius: 5,
                          color: tempRange === r ? T.rangeBtnActiveCol : T.rangeBtnCol,
                          fontSize: "0.68rem", fontWeight: 600, padding: "0.2rem 0.45rem", cursor: "pointer",
                        }}>{r}</button>
                      ))}
                    </div>
                  </div>
                  {tempLoading ? (
                    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "0.78rem", color: T.pendingCol }}>Loading…</span>
                    </div>
                  ) : tempHistory.length > 0 ? (
                    <TempLineChart data={tempHistory} color="#818cf8" yKey="humidity_pct" unit="%" tokens={T} />
                  ) : (
                    <PendingChart color="#818cf8" label="No humidity data yet — DHT22 wired to GPIO 4" tokens={T} />
                  )}
                </div>
              )}

              {/* Air tab */}
              {activeTab === "air" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                    <h3 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: T.h3Color }}>Air Quality Trend</h3>
                    <div style={{ display: "flex", gap: 3 }}>
                      {(["1h","6h","24h","7d"] as string[]).map(r => (
                        <button key={r} onClick={() => setMq135Range(r)} style={{
                          background: mq135Range === r ? T.rangeBtnActive : T.rangeBtnBg,
                          border: "none", borderRadius: 5,
                          color: mq135Range === r ? T.rangeBtnActiveCol : T.rangeBtnCol,
                          fontSize: "0.68rem", fontWeight: 600, padding: "0.2rem 0.45rem", cursor: "pointer",
                        }}>{r}</button>
                      ))}
                    </div>
                  </div>
                  {mq135AirLoad ? (
                    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "0.78rem", color: T.pendingCol }}>Loading…</span>
                    </div>
                  ) : mq135History.length > 0 ? (
                    <AirLineChart data={mq135History} tokens={T} />
                  ) : (
                    <PendingChart color="#10b981" label="No air quality data yet — MQ-135 wired to GPIO 34" bar tokens={T} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>{/* end map+panel row */}

      <style>{`
        @keyframes slideInPanel {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MetricCard
// ═════════════════════════════════════════════════════════════════════════════

function MetricCard({ icon, iconBg, iconColor, label, labelColor, value, valueColor, pending = false, tokens }: {
  icon: string; iconBg: string; iconColor: string;
  label: string; labelColor: string;
  value: string; valueColor: string;
  pending?: boolean; tokens: TokenMap;
}) {
  const T = tokens;
  return (
    <div style={{ padding: "0.875rem", background: T.metricBg, borderRadius: 10, border: `1px solid ${T.metricBorder}`, opacity: pending ? 0.6 : 1 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{icon}</div>
      <p style={{ margin: "0 0 0.2rem", fontSize: "1.3rem", fontWeight: 800, color: valueColor, lineHeight: 1 }}>{value}</p>
      <p style={{ margin: 0, fontSize: "0.68rem", color: labelColor, fontWeight: 600 }}>{label}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LightLineChart — signal trend
// ═════════════════════════════════════════════════════════════════════════════

function LightLineChart({ data, color, yKey, tooltipLabel, tokens, chartRange }: {
  data: WifiHistoryBucket[]; color: string; yKey: keyof WifiHistoryBucket;
  tooltipLabel: string; yAxisLabel: string; tokens: TokenMap; chartRange: TimeRange;
}) {
  const T = tokens;
  const [tooltip, setTooltip] = useState<{ x: number; y: number; bucket: WifiHistoryBucket } | null>(null);
  const W = 284, H = 160;
  const PAD = { top: 12, right: 8, bottom: 24, left: 30 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const values = data.map(d => (d[yKey] as number) ?? 0);
  const maxVal = Math.max(...values, 1);
  const pts = data.map((d, i) => ({
    x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
    y: PAD.top + (1 - ((d[yKey] as number) ?? 0) / maxVal) * chartH, d,
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = linePath + ` L${pts[pts.length-1].x.toFixed(1)},${(PAD.top+chartH).toFixed(1)} L${PAD.left},${(PAD.top+chartH).toFixed(1)} Z`;
  const yLabels = [0, Math.round(maxVal / 2), maxVal];
  const xLabels = data.filter((_, i) => i % 4 === 0 || i === data.length - 1);

  if (!data || data.length === 0) {
    return <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>No data in selected range</span>
    </div>;
  }

  return (
    <div style={{ position: "relative" }}>
      <svg width={W} height={H} style={{ overflow: "visible", display: "block" }} onMouseLeave={() => setTooltip(null)}>
        {yLabels.map((v, i) => {
          const y = PAD.top + (1 - v / maxVal) * chartH;
          return <g key={i}>
            <line x1={PAD.left} y1={y} x2={PAD.left+chartW} y2={y} stroke={T.gridLinCol} strokeWidth={1} />
            <text x={PAD.left-4} y={y+4} textAnchor="end" fill="#9ca3af" fontSize={9} fontFamily="monospace">{v}</text>
          </g>;
        })}
        <defs>
          <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#grad-${color.replace("#","")})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={8} fill="transparent" onMouseEnter={() => setTooltip({ x: p.x, y: p.y, bucket: p.d })} />)}
        {tooltip && (() => { const pp = pts.find(p => p.d === tooltip.bucket); return pp ? <circle cx={pp.x} cy={pp.y} r={4} fill={color} stroke="#fff" strokeWidth={2} /> : null; })()}
        {xLabels.map(d => {
          const i = data.indexOf(d);
          const x = PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
          return <text key={i} x={x} y={H-2} textAnchor="middle" fill="#9ca3af" fontSize={9} fontFamily="monospace">
            {d.bucket_start ? formatXAxisLabel(d.bucket_start, chartRange) : d.label}
          </text>;
        })}
      </svg>
      {tooltip && (
        <div style={{
          position: "absolute", left: Math.min(tooltip.x+4, W-120), top: Math.max(tooltip.y-48, 0),
          background: T.tooltipBg, border: `1px solid ${T.tooltipBorder}`, borderRadius: 8,
          padding: "0.3rem 0.6rem", fontSize: "0.72rem", color: T.tooltipCol,
          pointerEvents: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", whiteSpace: "nowrap", zIndex: 10,
        }}>
          <span style={{ color: T.tooltipSubCol }}>
            {tooltip.bucket.bucket_start ? formatBucketTime(tooltip.bucket.bucket_start, chartRange) : tooltip.bucket.label + " ago"}
          </span><br />
          <span style={{ color, fontWeight: 700 }}>{tooltipLabel}: {String(tooltip.bucket[yKey] ?? "—")}</span>
          {tooltip.bucket.avg_rssi != null && <><br /><span style={{ color: T.tooltipSubCol }}>{tooltip.bucket.avg_rssi} dBm</span></>}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TempLineChart — temperature or humidity history
// ═════════════════════════════════════════════════════════════════════════════

function TempLineChart({ data, color, yKey, unit, tokens }: {
  data: Dht22Reading[]; color: string;
  yKey: "temperature_c" | "humidity_pct"; unit: string; tokens: TokenMap;
}) {
  const T = tokens;
  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: Dht22Reading } | null>(null);
  const W = 284, H = 160;
  const PAD = { top: 12, right: 8, bottom: 28, left: 34 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const values = data.map(d => d[yKey]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range  = maxVal - minVal || 1;
  const pts = data.map((d, i) => ({
    x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
    y: PAD.top + (1 - (d[yKey] - minVal) / range) * chartH, d,
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = linePath + ` L${pts[pts.length-1].x},${PAD.top+chartH} L${PAD.left},${PAD.top+chartH} Z`;
  const xLabels = data.filter((_, i) => i === 0 || i === Math.floor(data.length/2) || i === data.length - 1);

  return (
    <div style={{ position: "relative" }}>
      <svg width={W} height={H} style={{ overflow: "visible", display: "block" }} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id={`tgrad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[minVal, (minVal+maxVal)/2, maxVal].map((v, i) => {
          const y = PAD.top + (1 - (v - minVal) / range) * chartH;
          return <g key={i}>
            <line x1={PAD.left} y1={y} x2={PAD.left+chartW} y2={y} stroke={T.gridLinCol} strokeWidth={1} />
            <text x={PAD.left-4} y={y+4} textAnchor="end" fill="#9ca3af" fontSize={8} fontFamily="monospace">{v.toFixed(1)}</text>
          </g>;
        })}
        <path d={fillPath} fill={`url(#tgrad-${color.replace("#","")})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={6} fill="transparent" onMouseEnter={() => setTooltip({ x: p.x, y: p.y, d: p.d })} />)}
        {tooltip && (() => { const pp = pts.find(p => p.d === tooltip.d); return pp ? <circle cx={pp.x} cy={pp.y} r={4} fill={color} stroke="#fff" strokeWidth={2} /> : null; })()}
        {xLabels.map(d => {
          const i = data.indexOf(d);
          const x = PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
          return <text key={i} x={x} y={H-2} textAnchor="middle" fill="#9ca3af" fontSize={8} fontFamily="monospace">
            {new Date(d.received_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </text>;
        })}
      </svg>
      {tooltip && (
        <div style={{
          position: "absolute", left: Math.min(tooltip.x+4, W-140), top: Math.max(tooltip.y-52, 0),
          background: T.tooltipBg, border: `1px solid ${T.tooltipBorder}`, borderRadius: 8,
          padding: "0.3rem 0.6rem", fontSize: "0.72rem", color: T.tooltipCol,
          pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}>
          <span style={{ color: T.tooltipSubCol }}>
            {new Date(tooltip.d.received_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span><br />
          <span style={{ color, fontWeight: 700 }}>{tooltip.d[yKey].toFixed(1)} {unit}</span>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PendingChart — placeholder for sensors not yet wired
// ═════════════════════════════════════════════════════════════════════════════

function PendingChart({ color, label, bar = false, tokens }: { color: string; label: string; bar?: boolean; tokens: TokenMap }) {
  const T = tokens;
  const W = 284, H = 160;
  const PAD = { top: 12, right: 8, bottom: 24, left: 30 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const fakeData = Array.from({ length: 20 }, (_, i) => ({
    x: PAD.left + (i / 19) * chartW,
    y: PAD.top + (0.2 + Math.random() * 0.6) * chartH,
  }));
  const linePath = fakeData.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <div style={{ position: "relative" }}>
      <svg width={W} height={H} style={{ display: "block", opacity: 0.25 }}>
        {[0, 0.5, 1].map((pct, i) => <line key={i} x1={PAD.left} y1={PAD.top+pct*chartH} x2={PAD.left+chartW} y2={PAD.top+pct*chartH} stroke={T.gridLinCol} strokeWidth={1} />)}
        {bar ? fakeData.filter((_, i) => i % 2 === 0).map((p, i) => <rect key={i} x={p.x-4} y={p.y} width={8} height={PAD.top+chartH-p.y} fill={color} rx={2} />)
             : <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
        {["19m","15m","11m","7m","3m","1m"].map((lbl, i) => <text key={i} x={PAD.left+(i/5)*chartW} y={H-2} textAnchor="middle" fill="#9ca3af" fontSize={9}>{lbl}</text>)}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
        <span style={{ fontSize: "1.25rem" }}>🔌</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: T.listLabelCol }}>Sensor pending</span>
        <span style={{ fontSize: "0.68rem", color: "#9ca3af", textAlign: "center", maxWidth: 180 }}>{label}</span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AirLineChart — line chart for MQ-135 air quality (raw ADC over time)
// Same pattern as TempLineChart but coloured by air quality level
// ═════════════════════════════════════════════════════════════════════════════

function AirLineChart({ data, tokens }: { data: Mq135Reading[]; tokens: TokenMap }) {
  const T = tokens;
  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: Mq135Reading } | null>(null);
  const W = 284, H = 160;
  const PAD = { top: 12, right: 8, bottom: 28, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const values = data.map(d => d.raw_value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range  = maxVal - minVal || 1;
  const pts = data.map((d, i) => ({
    x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
    y: PAD.top + (1 - (d.raw_value - minVal) / range) * chartH,
    d,
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = linePath + ` L${pts[pts.length-1].x},${PAD.top+chartH} L${PAD.left},${PAD.top+chartH} Z`;
  const xLabels = data.filter((_, i) => i === 0 || i === Math.floor(data.length/2) || i === data.length - 1);
  // Colour the line based on average air level
  const avgRaw = values.reduce((a,b) => a+b, 0) / values.length;
  const lineColor = avgRaw < 2000 ? "#22c55e" : avgRaw < 2800 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ position: "relative" }}>
      <svg width={W} height={H} style={{ overflow: "visible", display: "block" }} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id={`airgrad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[minVal, (minVal+maxVal)/2, maxVal].map((v, i) => {
          const y = PAD.top + (1 - (v - minVal) / range) * chartH;
          const zoneLabel = v < 2000 ? "Good" : v < 2800 ? "Mod" : "Poor";
          return <g key={i}>
            <line x1={PAD.left} y1={y} x2={PAD.left+chartW} y2={y} stroke={T.gridLinCol} strokeWidth={1} />
            <text x={PAD.left-4} y={y+4} textAnchor="end" fill="#9ca3af" fontSize={8} fontFamily="monospace">{zoneLabel}</text>
          </g>;
        })}
        <path d={fillPath} fill="url(#airgrad)" />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={6} fill="transparent" onMouseEnter={() => setTooltip({ x: p.x, y: p.y, d: p.d })} />)}
        {tooltip && (() => { const pp = pts.find(p => p.d === tooltip.d); return pp ? <circle cx={pp.x} cy={pp.y} r={4} fill={lineColor} stroke="#fff" strokeWidth={2} /> : null; })()}
        {xLabels.map(d => {
          const i = data.indexOf(d);
          const x = PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
          return <text key={i} x={x} y={H-2} textAnchor="middle" fill="#9ca3af" fontSize={8} fontFamily="monospace">
            {new Date(d.received_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </text>;
        })}
      </svg>
      {tooltip && (
        <div style={{
          position: "absolute", left: Math.min(tooltip.x+4, W-160), top: Math.max(tooltip.y-52, 0),
          background: T.tooltipBg, border: `1px solid ${T.tooltipBorder}`, borderRadius: 8,
          padding: "0.3rem 0.6rem", fontSize: "0.72rem", color: T.tooltipCol,
          pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}>
          <span style={{ color: T.tooltipSubCol }}>
            {new Date(tooltip.d.received_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span><br />
          <span style={{ color: lineColor, fontWeight: 700 }}>
            🌿 {tooltip.d.raw_value} ppm — {tooltip.d.raw_value < 2000 ? "Good" : tooltip.d.raw_value < 2800 ? "Moderate" : "Poor"}
          </span>
        </div>
      )}
    </div>
  );
}