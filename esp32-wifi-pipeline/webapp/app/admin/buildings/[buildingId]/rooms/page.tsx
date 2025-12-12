// webapp/app/admin/buildings/[buildingId]/rooms/page.tsx
// app/admin/buildings/[buildingId]/rooms/page.tsx
"use client";

import { useEffect, useState, FormEvent, use } from "react";
import Link from "next/link";
import {
  fetchRooms,
  fetchBuildings,
  fetchScanSessions,
  startRoomScan,
  stopRoomScan,
  createRoom,
  updateRoom,
  deleteRoom,
  type Room,
} from "@/lib/api";

type Props = {
  params: { buildingId: string };
};

type RoomWithStatus = Room & { isActive: boolean };

export default function AdminRoomsPage({ params }: Props) {
  const resolvedParams = use(params);
  const buildingId = Number(resolvedParams.buildingId);
  
  if (isNaN(buildingId)) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Invalid building ID</h2>
          <p>The building ID in the URL is not valid.</p>
        </div>
      </div>
    );
  }

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
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
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

  // -------- room form submit --------
  async function handleRoomSubmit(e: FormEvent) {
    e.preventDefault();

    if (!newRoomName.trim()) {
      setError("Room name is required");
      return;
    }

    try {
      setSavingRoom(true);
      setError(null);

      if (editingRoom) {
        await updateRoom(editingRoom.id, {
          name: newRoomName.trim(),
          floor: newRoomFloor.trim() || undefined,
          room_type: newRoomType.trim() || undefined,
        });
      } else {
        await createRoom({
          name: newRoomName.trim(),
          building_id: buildingId,
          floor: newRoomFloor.trim() || undefined,
          room_type: newRoomType.trim() || undefined,
        });
      }

      // clear + close modal
      setNewRoomName("");
      setNewRoomFloor("");
      setNewRoomType("");
      setShowAddRoom(false);
      setEditingRoom(null);

      // refresh table
      await loadData();
    } catch (err) {
      console.error(err);
      setError(editingRoom ? "Could not update room" : "Could not create room");
    } finally {
      setSavingRoom(false);
    }
  }

  function handleEditRoom(room: RoomWithStatus) {
    setEditingRoom(room);
    setNewRoomName(room.name);
    setNewRoomFloor(room.floor || "");
    setNewRoomType(room.room_type || "");
    setShowAddRoom(true);
  }

  async function handleDeleteRoom(roomId: number, roomName: string) {
    if (!window.confirm(`Delete room "${roomName}"? This will also delete all scan data for this room.`)) {
      return;
    }

    try {
      setError(null);
      await deleteRoom(roomId);
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Could not delete room");
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
          onClick={() => {
            setError(null);
            setShowAddRoom(true);
          }}
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
        <div className="rooms-grid">
          <div className="rooms-header">
            <div className="rooms-header-cell">Room Name</div>
            <div className="rooms-header-cell">Floor</div>
            <div className="rooms-header-cell">Room Type</div>
            <div className="rooms-header-cell">Scan Status</div>
            <div className="rooms-header-cell">Actions</div>
          </div>
          {rooms.map((room) => {
            const busy = actionRoomId === room.id;
            return (
              <div key={room.id} className="room-row">
                <div className="room-cell room-name-cell">
                  <div className="room-icon">📚</div>
                  <Link href={`/admin/rooms/${room.id}`} className="room-name-link">
                    {room.name}
                  </Link>
                </div>
                <div className="room-cell">{room.floor ?? "—"}</div>
                <div className="room-cell">
                  <span className="room-type-badge">{room.room_type ?? "—"}</span>
                </div>
                <div className="room-cell">
                  <span className={room.isActive ? "status-active" : "status-inactive"}>
                    {room.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="room-cell room-actions">
                  {room.isActive ? (
                    <button
                      type="button"
                      className="button button-stop"
                      onClick={() => void handleStop(room.id)}
                      disabled={busy}
                    >
                      {busy ? "Stopping…" : "Stop Scan"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button button-start"
                      onClick={() => void handleStart(room.id)}
                      disabled={busy}
                    >
                      {busy ? "Starting…" : "Start Scan"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-edit"
                    onClick={() => handleEditRoom(room)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button button-delete"
                    onClick={() => void handleDeleteRoom(room.id, room.name)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -------- Add/Edit Room Modal -------- */}
      {showAddRoom && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2 className="modal-title">{editingRoom ? "Edit Room" : "Add New Room"}</h2>

            <form onSubmit={handleRoomSubmit} className="modal-form">
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
                  onClick={() => {
                    setShowAddRoom(false);
                    setEditingRoom(null);
                    setNewRoomName("");
                    setNewRoomFloor("");
                    setNewRoomType("");
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={savingRoom || !newRoomName.trim()}
                >
                  {savingRoom ? (editingRoom ? "Updating…" : "Adding…") : (editingRoom ? "Update Room" : "Add Room")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}