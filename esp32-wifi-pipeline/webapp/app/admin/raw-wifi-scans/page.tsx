// app/admin/raw-wifi-scans/page.tsx

import { fetchRecentScans, type WifiScan } from "@/lib/api";

export const dynamic = "force-dynamic"; // always fresh while developing

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function classifySignal(rssi: number | null): {
  label: string;
  className: string;
} {
  if (rssi == null) {
    return { label: "Unknown", className: "badge badge-muted" };
  }

  // you can tweak these thresholds later
  if (rssi >= -50) return { label: "Strong", className: "badge badge-success" };
  if (rssi >= -70) return { label: "Medium", className: "badge badge-warning" };
  return { label: "Weak", className: "badge badge-error" };
}

export default async function AdminRawWifiScansPage() {
  const scans: WifiScan[] = await fetchRecentScans(50); // last 50 scans

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Raw Wi-Fi Scans</h1>
          <p className="page-subtitle">
            Most recent Wi-Fi scans received from the ESP32 device.
          </p>
        </div>
      </header>

      {scans.length === 0 ? (
        <div className="empty-state">
          <h2>No scans yet</h2>
          <p>
            Once your ESP32 starts sending data, the latest scans will appear
            here.
          </p>
        </div>
      ) : (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>SSID</th>
                <th>BSSID</th>
                <th>RSSI (dBm)</th>
                <th>Signal</th>
                <th>Channel</th>
                <th>Room</th>
                <th>Building</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const { label, className } = classifySignal(scan.rssi);
                return (
                  <tr key={scan.id}>
                    <td>{scan.ssid ?? "—"}</td>
                    <td>{scan.bssid ?? "—"}</td>
                    <td>{scan.rssi ?? "—"}</td>
                    <td>
                      <span className={className}>{label}</span>
                    </td>
                    <td>{scan.channel ?? "—"}</td>
                    <td>{scan.room_name ?? "—"}</td>
                    <td>{scan.building_name ?? "—"}</td>
                    <td>{formatDate(scan.received_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}