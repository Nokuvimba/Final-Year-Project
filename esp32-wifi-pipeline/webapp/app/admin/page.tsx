// app/admin/page.tsx
import { fetchBuildings, fetchScanSessions, fetchRecentScans } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [buildings, sessions, recentScans] = await Promise.all([
    fetchBuildings(),
    fetchScanSessions(),
    fetchRecentScans(10),
  ]);

  const activeScans = sessions.filter(s => s.is_active).length;
  const totalRooms = buildings.reduce((sum, b) => sum + (b.rooms?.length || 0), 0);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">
            Wi-Fi Indoor Mapping System Overview
          </p>
        </div>
      </header>

      <section className="metrics-row">
        <div className="metric-card metric-card-blue">
          <div className="metric-card-title">Buildings</div>
          <div className="metric-card-value">{buildings.length}</div>
        </div>

        <div className="metric-card metric-card-green">
          <div className="metric-card-title">Active Scans</div>
          <div className="metric-card-value">{activeScans}</div>
        </div>

        <div className="metric-card metric-card-purple">
          <div className="metric-card-title">Total Sessions</div>
          <div className="metric-card-value">{sessions.length}</div>
        </div>

        <div className="metric-card metric-card-blue">
          <div className="metric-card-title">Recent Scans</div>
          <div className="metric-card-value">{recentScans.length}</div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <section className="table-card">
          <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>Recent Buildings</h3>
          {buildings.length === 0 ? (
            <p style={{ color: "#9ca3af" }}>No buildings created yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {buildings.slice(0, 5).map(building => (
                <div key={building.id} style={{ 
                  padding: "12px", 
                  background: "#1f2937", 
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <div style={{ fontWeight: "500" }}>{building.name}</div>
                    {building.description && (
                      <div style={{ fontSize: "12px", color: "#9ca3af" }}>{building.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="table-card">
          <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>Active Sessions</h3>
          {activeScans === 0 ? (
            <p style={{ color: "#9ca3af" }}>No active scanning sessions</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {sessions.filter(s => s.is_active).slice(0, 5).map(session => (
                <div key={session.id} style={{ 
                  padding: "12px", 
                  background: "#1f2937", 
                  borderRadius: "8px"
                }}>
                  <div style={{ fontWeight: "500" }}>{session.building_name} - {session.room_name}</div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                    Started: {new Date(session.started_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}