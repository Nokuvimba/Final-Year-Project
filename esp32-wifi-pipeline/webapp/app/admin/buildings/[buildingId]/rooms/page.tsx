// webapp/app/admin/buildings/[buildingId]/rooms/page.tsx
// app/admin/buildings/[buildingId]/rooms/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import {
  fetchRooms,
  fetchBuildings,
  fetchScanSessions,
  startRoomScan,
  stopRoomScan,
  createRoom,
  type Room,
} from "@/lib/api";

type Props = {
  params: { buildingId: string };
};

type RoomWithStatus = Room & { isActive: boolean };

export default function AdminRoomsPage({ params }: Props) {
  const buildingId = Number(params.buildingId);

  const [buildingName, setBuildingName] = useState<string>("");
  const [buildingDescription, setBuildingDescription] = useState<string | null>(
    null
  );
  const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionRoomId, setActionRoomId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // modal state
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomFloor, setNewRoomFloor] = useState("");
  const [newRoomType, setNewRoomType] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);

  // -------- load rooms + sessions --------
  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [buildings, roomList, sessions] = await Promise.all([
        fetchBuildings(),
        fetchRooms(buildingId),
        fetchScanSessions(),
      ]);

      const thisBuilding = buildings.find((b) => b.id === buildingId);
      setBuildingName(thisBuilding?.name ?? "Unknown building");
      setBuildingDescription(thisBuilding?.description ?? null);

      const activeByRoomId = new Set(
        sessions.filter((s) => s.is_active).map((s) => s.room_id)
      );

      const withStatus: RoomWithStatus[] = roomList.map((r) => ({
        ...r,
        isActive: activeByRoomId.has(r.id),
      }));

      setRooms(withStatus);
    } catch (err) {
      console.error(err);
      setError("Failed to load rooms or scan sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  // -------- start / stop scan handlers --------
  async function handleStart(roomId: number) {
    try {
      setActionRoomId(roomId);
      setError(null);
      await startRoomScan(roomId);
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Could not start scan for this room");
    } finally {
      setActionRoomId(null);
    }
  }

  async function handleStop(roomId: number) {
    try {
      setActionRoomId(roomId);
      setError(null);
      await stopRoomScan(roomId);
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Could not stop scan for this room");
    } finally {
      setActionRoomId(null);
    }
  }

  // -------- add room form submit --------
  async function handleAddRoomSubmit(e: FormEvent) {
    e.preventDefault();

    if (!newRoomName.trim()) {
      setError("Room name is required");
      return;
    }

    try {
      setSavingRoom(true);
      setError(null);

      await createRoom({
        name: newRoomName.trim(),
        building_id: buildingId,
        floor: newRoomFloor.trim() || undefined,
        room_type: newRoomType.trim() || undefined,
      });

      // clear + close modal
      setNewRoomName("");
      setNewRoomFloor("");
      setNewRoomType("");
      setShowAddRoom(false);

      // refresh table
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Could not create room");
    } finally {
      setSavingRoom(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <button
          className="link-back"
          onClick={() => history.back()}
          type="button"
        >
          ← Back to Buildings
        </button>

        <h1 className="page-title">{buildingName} – Rooms</h1>

        {buildingDescription && (
          <p className="page-subtitle">{buildingDescription}</p>
        )}

        <button
          className="button button-primary"
          type="button"
          onClick={() => setShowAddRoom(true)}
        >
          + Add Room
        </button>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <div className="empty-state">
          <h2>No rooms yet</h2>
          <p>Use “Add Room” to create your first room.</p>
        </div>
      ) : (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Room Name</th>
                <th>Floor</th>
                <th>Room Type</th>
                <th>Scan Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => {
                const busy = actionRoomId === room.id;
                return (
                  <tr key={room.id}>
                    <td>{room.name}</td>
                    <td>{room.floor ?? "—"}</td>
                    <td>{room.room_type ?? "—"}</td>
                    <td>
                      <span
                        className={
                          room.isActive
                            ? "badge badge-success"
                            : "badge badge-muted"
                        }
                      >
                        {room.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {room.isActive ? (
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => void handleStop(room.id)}
                          disabled={busy}
                        >
                          {busy ? "Stopping…" : "Stop Scan"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button button-success"
                          onClick={() => void handleStart(room.id)}
                          disabled={busy}
                        >
                          {busy ? "Starting…" : "Start Scan"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* -------- Add Room Modal -------- */}
      {showAddRoom && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2 className="modal-title">Add New Room</h2>

            <form onSubmit={handleAddRoomSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="room-name">
                  Room Name
                </label>
                <input
                  id="room-name"
                  className="input"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g., Room 101"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="room-floor">
                  Floor
                </label>
                <input
                  id="room-floor"
                  className="input"
                  value={newRoomFloor}
                  onChange={(e) => setNewRoomFloor(e.target.value)}
                  placeholder="e.g., 1"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="room-type">
                  Room Type
                </label>
                <input
                  id="room-type"
                  className="input"
                  value={newRoomType}
                  onChange={(e) => setNewRoomType(e.target.value)}
                  placeholder="e.g., Office, Lab, Lecture Hall"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowAddRoom(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={savingRoom || !newRoomName.trim()}
                >
                  {savingRoom ? "Adding…" : "Add Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}