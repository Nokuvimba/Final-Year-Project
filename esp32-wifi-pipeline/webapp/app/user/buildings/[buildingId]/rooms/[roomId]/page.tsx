// app/user/buildings/[buildingId]/rooms/[roomId]/page.tsx
import { fetchRoomScans, fetchBuildings, fetchRooms } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
  params: { buildingId: string; roomId: string };
};

function getSignalColor(rssi: number | null): string {
  if (rssi == null) return "#6b7280";
  if (rssi >= -50) return "#10b981"; // green - strong
  if (rssi >= -70) return "#f59e0b"; // yellow - medium
  return "#ef4444"; // red - weak
}

function getSignalLabel(rssi: number | null): string {
  if (rssi == null) return "Unknown";
  if (rssi >= -50) return "Strong";
  if (rssi >= -70) return "Medium";
  return "Weak";
}

export default async function UserRoomHeatmapPage({ params }: Props) {
  const resolvedParams = await params;
  const buildingId = Number(resolvedParams.buildingId);
  const roomId = Number(resolvedParams.roomId);
  
  const [buildings, rooms, roomData] = await Promise.all([
    fetchBuildings(),
    fetchRooms(buildingId),
    fetchRoomScans(roomId, 100),
  ]);

  const building = buildings.find(b => b.id === buildingId);
  const room = rooms.find(r => r.id === roomId);

  if (!building || !room) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Room not found</h2>
          <Link href="/user" className="button button-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Filter for strong WiFi networks only (RSSI >= -50 dBm)
  const strongNetworks = Array.from(
    new Map(
      roomData.rows
        .filter(scan => scan.ssid && scan.rssi && scan.rssi >= -50)
        .map(scan => [scan.ssid, scan])
    ).values()
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link href={`/user/buildings/${buildingId}`} className="link-back">
            ← Back to {building.name}
          </Link>
          <h1 className="page-title">{room.name} - Wi-Fi Heatmap</h1>
          <p className="page-subtitle">
            {building.name} • Generated from scan sessions
          </p>
        </div>
      </header>

      <section className="metrics-row">
        <div className="metric-card metric-card-blue">
          <div className="metric-card-title">Total Scans</div>
          <div className="metric-card-value">{roomData.rows.length}</div>
        </div>

        <div className="metric-card metric-card-green">
          <div className="metric-card-title">Strong Networks</div>
          <div className="metric-card-value">{strongNetworks.length}</div>
        </div>

        <div className="metric-card metric-card-purple">
          <div className="metric-card-title">Avg Signal</div>
          <div className="metric-card-value">
            {roomData.rows.length > 0 
              ? Math.round(roomData.rows.reduce((sum, r) => sum + (r.rssi || 0), 0) / roomData.rows.length)
              : 0} dBm
          </div>
        </div>
      </section>

      <section className="strong-networks-section">
        <h3 className="section-title" style={{ color: "#0f172a" }}>Strong Wi-Fi Networks Available</h3>
        {strongNetworks.length === 0 ? (
          <div className="empty-state">
            <p>No strong Wi-Fi networks detected in this room.</p>
            <small>Strong networks have signal strength of -50 dBm or better.</small>
          </div>
        ) : (
          <div className="networks-grid">
            {strongNetworks.map((scan, index) => (
              <div 
                key={scan.id} 
                className="network-card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="network-icon">📶</div>
                <div className="network-info">
                  <div className="network-ssid">{scan.ssid}</div>
                  <div className="network-strength">{scan.rssi} dBm • Strong Signal</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="table-card">
        <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>
          All Wi-Fi Networks
        </h3>
        <table className="table">
          <thead>
            <tr>
              <th>SSID</th>
              <th>BSSID</th>
              <th>RSSI</th>
              <th>Signal</th>
              <th>Channel</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {roomData.rows.map(scan => (
              <tr key={scan.id}>
                <td>{scan.ssid || "Hidden Network"}</td>
                <td style={{ fontFamily: "monospace", fontSize: "12px" }}>
                  {scan.bssid || "—"}
                </td>
                <td style={{ color: getSignalColor(scan.rssi) }}>
                  {scan.rssi}dBm
                </td>
                <td>
                  <span 
                    className="signal-badge"
                    style={{ 
                      backgroundColor: getSignalColor(scan.rssi) + "20",
                      color: getSignalColor(scan.rssi)
                    }}
                  >
                    {getSignalLabel(scan.rssi)}
                  </span>
                </td>
                <td>Ch {scan.channel}</td>
                <td>{new Date(scan.received_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}