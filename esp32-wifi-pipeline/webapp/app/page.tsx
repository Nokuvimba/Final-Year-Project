"use client";

import { useEffect, useState } from "react";
import {
  fetchBuildings,
  fetchRooms,
  fetchRecentScans,
  type Building,
  type Room,
  type WifiScan,
} from "@/lib/api";

export default function HomePage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [scans, setScans] = useState<WifiScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from the API once when the page mounts
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [b, r, s] = await Promise.all([
          fetchBuildings(),
          fetchRooms(),
          fetchRecentScans(20),
        ]);

        setBuildings(b);
        setRooms(r);
        setScans(s);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
        setError("Could not load data from the Wi-Fi API.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <main className="page">
      <h1 className="section-title">Multi-Sensor Analytics And Visualisation System</h1>

      {error && (
        <p className="card-subtext" style={{ marginBottom: "12px", color: "#f97373" }}>
          {error}
        </p>
      )}

      {/* BUILDINGS and ROOMS */}
      <section>
        <h2 className="section-title">Buildings &amp; Rooms</h2>

        {loading && buildings.length === 0 ? (
          <p className="card-subtext">Loading buildings…</p>
        ) : buildings.length === 0 ? (
          <p className="card-subtext">
            No buildings yet. Use the API (or later the UI) to add some.
          </p>
        ) : (
          buildings.map((b) => {
            const roomsForBuilding = rooms.filter(
              (r) => r.building_id === b.id
            );

            return (
              <div className="card" key={b.id}>
                <div className="card-header">
                  <span>{b.name}</span>
                  <span className="card-subtext">
                    {b.description || "No description"}
                  </span>
                </div>

                {roomsForBuilding.length === 0 ? (
                  <p className="card-subtext">
                    No rooms defined yet for this building.
                  </p>
                ) : (
                  <ul className="room-list">
                    {roomsForBuilding.map((r) => (
                      <li className="room-item" key={r.id}>
                        {r.name}
                        {r.floor && ` · ${r.floor}`}
                        {r.room_type && ` · ${r.room_type}`}
                        <span className="card-subtext"> (id: {r.id})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* RECENT WI-FI SCANS*/}
      <section style={{ marginTop: "24px" }}>
        <h2 className="section-title">Recent Wi-Fi Scans</h2>

        {loading && scans.length === 0 ? (
          <p className="card-subtext">Loading scans…</p>
        ) : scans.length === 0 ? (
          <p className="card-subtext">
            No scans found yet. Make sure the ESP32 is posting to /ingest.
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Time</th>
                  <th>Node</th>
                  <th>SSID</th>
                  <th>RSSI</th>
                  <th>Room</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td className="time">
                      {s.received_at
                        ? new Date(s.received_at).toLocaleTimeString()
                        : "—"}
                    </td>
                    <td>{s.node ?? "—"}</td>
                    <td>{s.ssid ?? "—"}</td>
                    <td>{s.rssi ?? "—"}</td>
                    <td>{s.room_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}