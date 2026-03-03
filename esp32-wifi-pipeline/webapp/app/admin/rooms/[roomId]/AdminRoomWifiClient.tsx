"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchRoomScans, fetchBuildings, type RoomScanData, type Building } from "@/lib/api";

interface Props {
  roomId: number;
  variant?: "page" | "panel";
}

function getSignalColor(rssi: number | null): string {
  if (rssi == null) return "#6b7280";
  if (rssi >= -50) return "#10b981";
  if (rssi >= -70) return "#f59e0b"; 
  return "#ef4444";
}

function getSignalLabel(rssi: number | null): string {
  if (rssi == null) return "Unknown";
  if (rssi >= -50) return "Strong";
  if (rssi >= -70) return "Medium";
  return "Weak";
}

export function AdminRoomWifiClient({ roomId, variant = "page" }: Props) {
  const [roomData, setRoomData] = useState<RoomScanData | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [roomScans, buildingsData] = await Promise.all([
          fetchRoomScans(roomId, 100),
          fetchBuildings()
        ]);
        setRoomData(roomScans);
        setBuildings(buildingsData);
      } catch (err) {
        setError("Failed to load WiFi data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [roomId]);

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading WiFi data...</div>;
  }

  if (error || !roomData) {
    return <div className="text-red-400 text-sm">{error || "Error loading WiFi data"}</div>;
  }

  const building = buildings.find(b => b.id === roomData.room.building_id);
  const uniqueNetworks = Array.from(
    new Map(
      roomData.rows
        .filter(scan => scan.ssid)
        .map(scan => [scan.ssid, scan])
    ).values()
  );

  return (
    <div className={variant === "page" ? "page" : ""}>
      {variant === "page" && (
        <header className="page-header">
          <div>
            <Link href={`/admin/buildings/${roomData.room.building_id}/rooms`} className="link-back">
              ← Back to Rooms
            </Link>
            <div className="room-header">
              <div className="room-header-icon">📍</div>
              <div>
                <h1 className="page-title">{roomData.room.name} - Wi-Fi Heatmap</h1>
                <p className="page-subtitle">
                  {building?.name} • {roomData.room.floor && `Floor ${roomData.room.floor}`} • {roomData.room.room_type}
                </p>
              </div>
            </div>
            <p className="generated-label">⚡ Generated from scan sessions • Auto-refreshing</p>
          </div>
        </header>
      )}

      {variant === "panel" && (
        <>
          <div className="mb-3">
            <div className="text-xs text-slate-400">Room: {roomData.room.name}</div>
            <div className="text-sm text-slate-300">
              {roomData.rows.length} scans • {uniqueNetworks.length} networks • Avg: {roomData.rows.length > 0 
                ? Math.round(roomData.rows.reduce((sum, r) => sum + (r.rssi || 0), 0) / roomData.rows.length)
                : 0} dBm
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-slate-400">Signal Density</div>
              <div className="text-lg font-semibold text-green-400">Medium</div>
            </div>

            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-slate-400">Temperature</div>
              <div className="text-lg font-semibold">22.4°C</div>
            </div>

            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-slate-400">Humidity</div>
              <div className="text-lg font-semibold">45%</div>
            </div>

            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-slate-400">Air Quality</div>
              <div className="text-lg font-semibold text-yellow-400">Moderate</div>
            </div>
          </div>
        </>
      )}

      {variant === "page" && (
        <section className="metrics-row">
        <div className="metric-card metric-card-blue">
          <div className="metric-icon">📶</div>
          <div className="metric-content">
            <div className="metric-card-value">{roomData.rows.length}</div>
            <div className="metric-card-title">Total Scans</div>
          </div>
        </div>

        <div className="metric-card metric-card-purple">
          <div className="metric-icon">📶</div>
          <div className="metric-content">
            <div className="metric-card-value">{uniqueNetworks.length}</div>
            <div className="metric-card-title">Unique Networks</div>
          </div>
        </div>

        <div className="metric-card metric-card-green">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <div className="metric-card-value">
              {roomData.rows.length > 0 
                ? Math.round(roomData.rows.reduce((sum, r) => sum + (r.rssi || 0), 0) / roomData.rows.length)
                : 0} dBm
            </div>
            <div className="metric-card-title">Average Signal</div>
          </div>
        </div>
        </section>
      )}

      {variant === "page" && (
        <div className="heatmap-container">
        <h3 className="heatmap-title">Signal Strength Heatmap</h3>
        <div className="heatmap-grid">
          {(() => {
            const strongestScan = roomData.rows.filter(s => s.rssi && s.rssi >= -50).sort((a, b) => (b.rssi || 0) - (a.rssi || 0))[0];
            const mediumScan = roomData.rows.filter(s => s.rssi && s.rssi >= -70 && s.rssi < -50)[0];
            const weakestScan = roomData.rows.filter(s => s.rssi && s.rssi < -70).sort((a, b) => (a.rssi || 0) - (b.rssi || 0))[0];
            
            return [strongestScan, mediumScan, weakestScan].filter(Boolean).map((scan, index) => (
              <div 
                key={scan.id} 
                className="heatmap-cell"
                style={{ 
                  backgroundColor: getSignalColor(scan.rssi),
                  animationDelay: `${index * 0.1}s`
                }}
              >
                <div className="heatmap-cell-content">
                  <div className="heatmap-icon">📶</div>
                  <div className="heatmap-ssid">{scan.ssid}</div>
                  <div className="heatmap-rssi">{scan.rssi} dBm</div>
                  <div className="heatmap-label">{getSignalLabel(scan.rssi)}</div>
                </div>
              </div>
            ));
          })()
          }
        </div>
        </div>
      )}

      <section className={variant === "page" ? "detailed-scans" : ""}>
        {variant === "page" && <h3 className="detailed-title">Detailed Scan Data</h3>}
        <div className={variant === "page" ? "table-card" : ""}>
          <table className={variant === "page" ? "table" : "w-full text-xs"}>
            <thead>
              <tr className={variant === "panel" ? "text-slate-400 text-left" : ""}>
                <th className={variant === "panel" ? "pb-2" : ""}>SSID</th>
                {variant === "page" && <th>BSSID</th>}
                <th className={variant === "panel" ? "pb-2" : ""}>RSSI</th>
                {variant === "page" && <th>Signal Strength</th>}
                <th className={variant === "panel" ? "pb-2" : ""}>Channel</th>
                {variant === "page" && <th>Time</th>}
              </tr>
            </thead>
            <tbody>
              {roomData.rows.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()).slice(0, variant === "panel" ? 15 : undefined).map(scan => (
                <tr key={scan.id} className={variant === "panel" ? "border-b border-white/5" : ""}>
                  <td className={variant === "panel" ? "py-2" : ""}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {variant === "page" && <span style={{ color: "#3b82f6" }}>📶</span>}
                      <span className={variant === "panel" ? "text-slate-200" : ""}>{scan.ssid || "Hidden"}</span>
                    </div>
                  </td>
                  {variant === "page" && (
                    <td style={{ fontFamily: "monospace", fontSize: "12px", color: "#6b7280" }}>
                      {scan.bssid || "—"}
                    </td>
                  )}
                  <td className={variant === "panel" ? "py-2" : ""} style={{ fontWeight: "600" }}>
                    <span className={variant === "panel" ? `px-2 py-0.5 rounded text-[10px] ${
                      (scan.rssi ?? -100) >= -50 ? "bg-green-500/20 text-green-400" :
                      (scan.rssi ?? -100) >= -70 ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    }` : ""}>
                      {scan.rssi} dBm
                    </span>
                  </td>
                  {variant === "page" && (
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span 
                          className="signal-badge"
                          style={{ 
                            backgroundColor: getSignalColor(scan.rssi) + "20",
                            color: getSignalColor(scan.rssi)
                          }}
                        >
                          {getSignalLabel(scan.rssi)}
                        </span>
                        <div 
                          className="signal-bar"
                          style={{ backgroundColor: getSignalColor(scan.rssi) }}
                        ></div>
                      </div>
                    </td>
                  )}
                  <td className={variant === "panel" ? "py-2 text-slate-400" : ""}>Ch {scan.channel}</td>
                  {variant === "page" && <td>{new Date(scan.received_at).toLocaleString()}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {variant === "page" && (
        <div className="signal-guide">
          <strong>Signal Strength Guide:</strong> Strong (green) = -50 dBm or better • Medium (yellow) = -50 to -70 dBm • Weak (red) = below -70 dBm
        </div>
      )}
    </div>
  );
}