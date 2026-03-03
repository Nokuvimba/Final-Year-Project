// app/user/page.tsx
import { fetchBuildings, fetchDevices } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UserDashboard() {
  const [buildings, devices] = await Promise.all([
    fetchBuildings(),
    fetchDevices(),
  ]);

  const activeDevices = devices.filter(d => d.is_active);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Wi-Fi Indoor Mapping</h1>
          <p className="page-subtitle">
            View real-time Wi-Fi scanning data and building information
          </p>
        </div>
        <Link href="/admin" className="button button-secondary">
          Admin Mode
        </Link>
      </header>

      <section className="metrics-row">
        <div className="metric-card metric-card-blue">
          <div className="metric-card-title">Buildings</div>
          <div className="metric-card-value">{buildings.length}</div>
        </div>

        <div className="metric-card metric-card-green">
          <div className="metric-card-title">Active Devices</div>
          <div className="metric-card-value">{activeDevices.length}</div>
        </div>

        <div className="metric-card metric-card-purple">
          <div className="metric-card-title">Total Devices</div>
          <div className="metric-card-value">{devices.length}</div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>Buildings</h2>
        {buildings.length === 0 ? (
          <div className="empty-state">
            <h3>No buildings available</h3>
            <p>Contact your administrator to set up buildings and rooms.</p>
          </div>
        ) : (
          <div className="cards-grid">
            {buildings.map(building => (
              <Link 
                key={building.id} 
                href={`/user/buildings/${building.id}`}
                className="building-card-link"
              >
                <div className="building-card">
                  <div className="building-card-icon">🏢</div>
                  <div className="building-card-content">
                    <h3 className="building-card-title">{building.name}</h3>
                    {building.description && (
                      <p className="building-card-description">{building.description}</p>
                    )}
                  </div>
                  <div className="building-card-chevron">›</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {activeDevices.length > 0 && (
        <section style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>Active Devices</h2>
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Building</th>
                  <th>Room</th>
                  <th>Assigned</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeDevices.map(device => (
                  <tr key={device.node}>
                    <td>{device.node}</td>
                    <td>{device.building_name}</td>
                    <td>{device.room_name}</td>
                    <td>{new Date(device.assigned_at).toLocaleString()}</td>
                    <td>
                      <span className="badge badge-success">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}