// app/admin/rooms/[roomId]/page.tsx
import { fetchRoomScans, fetchBuildings, fetchRooms } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
  params: { roomId: string };
};

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

export default async function AdminRoomWifiPage({ params }: Props) {
  const resolvedParams = await params;
  const roomId = Number(resolvedParams.roomId);
  
  if (isNaN(roomId)) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Invalid room ID</h2>
        </div>
      </div>
    );
  }

  const roomData = await fetchRoomScans(roomId, 100);
  const buildings = await fetchBuildings();
  
  const building = buildings.find(b => b.id === roomData.room.building_id);

  const uniqueNetworks = Array.from(
    new Map(
      roomData.rows
        .filter(scan => scan.ssid)
        .map(scan => [scan.ssid, scan])
    ).values()
  );

  return (
    <div className="page">
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
          <p className="generated-label">⚡ Generated from scan sessions</p>
        </div>
      </header>

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

      <section className="detailed-scans">
        <h3 className="detailed-title">Detailed Scan Data</h3>
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>SSID</th>
                <th>BSSID</th>
                <th>RSSI</th>
                <th>Signal Strength</th>
                <th>Channel</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {roomData.rows.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()).map(scan => (
                <tr key={scan.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#3b82f6" }}>📶</span>
                      {scan.ssid || "Hidden Network"}
                    </div>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "12px", color: "#6b7280" }}>
                    {scan.bssid || "—"}
                  </td>
                  <td style={{ fontWeight: "600" }}>{scan.rssi} dBm</td>
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
                  <td>Ch {scan.channel}</td>
                  <td>{new Date(scan.received_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="signal-guide">
        <strong>Signal Strength Guide:</strong> Strong (green) = -50 dBm or better • Medium (yellow) = -50 to -70 dBm • Weak (red) = below -70 dBm
      </div>
    </div>
  );
}