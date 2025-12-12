// app/admin/scans/page.tsx
import { fetchRecentScans, type WifiScan } from "@/lib/api";

export const dynamic = "force-dynamic";

function getSignalLabel(rssi: number | null): "Strong" | "Medium" | "Weak" | "Unknown" {
  if (rssi == null) return "Unknown";
  if (rssi >= -50) return "Strong";
  if (rssi >= -70) return "Medium";
  return "Weak";
}

function getSignalClass(label: string): string {
  if (label === "Strong") return "badge-success";
  if (label === "Medium") return "badge-warning";
  if (label === "Weak") return "badge-danger";
  return "badge-muted";
}

export default async function RawScansPage() {
  const scans = await fetchRecentScans(100);

  const totalScans = scans.length;
  const uniqueSsids = new Set(
    scans.map((s) => (s.ssid ?? "").trim()).filter(Boolean)
  ).size;

  const rssiValues = scans
    .map((s) => s.rssi)
    .filter((n): n is number => typeof n === "number");
  const avgRssi =
    rssiValues.length > 0
      ? Math.round(
          rssiValues.reduce((sum, val) => sum + val, 0) / rssiValues.length
        )
      : null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Raw Wi-Fi Scans</h1>
          <p className="page-subtitle">
            Developer debugging interface for raw scan data
          </p>
        </div>
      </header>

      {/* Metric cards */}
      <section className="metrics-row">
        <div className="metric-card metric-card-purple">
          <div className="metric-card-title">Total Scans</div>
          <div className="metric-card-value">{totalScans}</div>
        </div>

        <div className="metric-card metric-card-blue">
          <div className="metric-card-title">Unique SSIDs</div>
          <div className="metric-card-value">{uniqueSsids}</div>
        </div>

        <div className="metric-card metric-card-green">
          <div className="metric-card-title">Average RSSI</div>
          <div className="metric-card-value">
            {avgRssi != null ? `${avgRssi} dBm` : "—"}
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>SSID</th>
              <th>BSSID</th>
              <th>RSSI</th>
              <th>Signal</th>
              <th>Channel</th>
              <th>Time</th>
              <th>Node</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan: WifiScan) => {
              const signalLabel = getSignalLabel(scan.rssi);
              return (
                <tr key={scan.id}>
                  <td>{scan.ssid ?? "Unknown"}</td>
                  <td>{scan.bssid ?? "—"}</td>
                  <td>{scan.rssi != null ? `${scan.rssi} dBm` : "—"}</td>
                  <td>
                    <span
                      className={`badge ${getSignalClass(signalLabel)}`}
                    >
                      {signalLabel}
                    </span>
                  </td>
                  <td>{scan.channel != null ? `Ch ${scan.channel}` : "—"}</td>
                  <td>
                    {scan.received_at
                      ? new Date(scan.received_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>{scan.node ?? "—"}</td>
                  <td>{scan.room_name ?? "Unassigned"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}