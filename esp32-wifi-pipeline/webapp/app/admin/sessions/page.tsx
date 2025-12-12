// app/admin/sessions/page.tsx
import { fetchScanSessions, type ScanSession } from "@/lib/api";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function ScanSessionsPage() {
  const sessions = await fetchScanSessions();

  const activeSessions = sessions.filter((s) => s.is_active);
  const uniqueRooms = new Set(sessions.map((s) => s.room_id)).size;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Scan Sessions</h1>
          <p className="page-subtitle">
            Monitor and manage all Wi-Fi scanning sessions
          </p>
        </div>
      </header>

      {/* 🔹 Metric cards row (instead of plain text) */}
      <section className="metrics-row">
        <div className="metric-card metric-card-green">
          <div className="metric-card-title">Active Sessions</div>
          <div className="metric-card-value">{activeSessions.length}</div>
        </div>

        <div className="metric-card metric-card-blue">
          <div className="metric-card-title">Total Sessions</div>
          <div className="metric-card-value">{sessions.length}</div>
        </div>

        <div className="metric-card metric-card-purple">
          <div className="metric-card-title">Rooms Scanned</div>
          <div className="metric-card-value">{uniqueRooms}</div>
        </div>
      </section>

      {/* Table */}
      <section className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Building</th>
              <th>Room</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s: ScanSession) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.building_name}</td>
                <td>{s.room_name}</td>
                <td>{formatDateTime(s.started_at)}</td>
                <td>{formatDateTime(s.ended_at)}</td>
                <td>
                  <span
                    className={`badge ${
                      s.is_active ? "badge-success" : "badge-muted"
                    }`}
                  >
                    {s.is_active ? "Active" : "Stopped"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}