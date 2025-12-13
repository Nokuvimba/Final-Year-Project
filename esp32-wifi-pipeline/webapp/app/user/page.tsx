// app/user/page.tsx
import { fetchBuildings, fetchScanSessions } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UserDashboard() {
  const [buildings, sessions] = await Promise.all([
    fetchBuildings(),
    fetchScanSessions(),
  ]);

  const activeScans = sessions.filter(s => s.is_active);

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
          <div className="metric-card-title">Active Scans</div>
          <div className="metric-card-value">{activeScans.length}</div>
        </div>

        <div className="metric-card metric-card-purple">
          <div className="metric-card-title">Total Sessions</div>
          <div className="metric-card-value">{sessions.length}</div>
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

      {activeScans.length > 0 && (
        <section style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>Active Scanning Sessions</h2>
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Building</th>
                  <th>Room</th>
                  <th>Started</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeScans.map(session => (
                  <tr key={session.id}>
                    <td>{session.building_name}</td>
                    <td>{session.room_name}</td>
                    <td>{new Date(session.started_at).toLocaleString()}</td>
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