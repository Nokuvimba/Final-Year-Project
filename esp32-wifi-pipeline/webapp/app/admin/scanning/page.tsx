"use client";

// app/admin/scanning/page.tsx
// Multi-device scanning dashboard — replaces the old scan sessions page.
// Each ESP32 is shown as a card with its current room assignment.
// The admin can assign or clear rooms without any start/stop session flow.

import { useState, useEffect, useCallback } from "react";
import {
  fetchDevices,
  fetchRooms,
  assignDeviceToRoom,
  clearDeviceRoom,
  type Device,
  type Room,
} from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

type GroupedRooms = {
  building_name: string;
  building_id: number;
  rooms: Room[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function groupRoomsByBuilding(rooms: Room[]): GroupedRooms[] {
  const map = new Map<number, GroupedRooms>();
  for (const room of rooms) {
    if (!map.has(room.building_id)) {
      map.set(room.building_id, {
        building_id: room.building_id,
        building_name: room.building_name,
        rooms: [],
      });
    }
    map.get(room.building_id)!.rooms.push(room);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.building_name.localeCompare(b.building_name)
  );
}

function signalBadge(count: number | null) {
  if (!count) return null;
  return (
    <span className="badge badge-success" style={{ fontSize: "11px" }}>
      {count} scans
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ScanningDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-device UI state
  const [assigningNode, setAssigningNode] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Record<string, number>>({});
  const [actionNode, setActionNode] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [deviceList, roomList] = await Promise.all([
        fetchDevices(),
        fetchRooms(),
      ]);
      setDevices(deviceList);
      setRooms(roomList);
    } catch (err) {
      console.error(err);
      setError("Failed to load devices or rooms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    // Auto-refresh every 10 seconds so new devices appear automatically
    const interval = setInterval(() => void loadData(), 10_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleAssign(node: string) {
    const roomId = selectedRoom[node];
    if (!roomId) return;

    try {
      setActionNode(node);
      setError(null);
      await assignDeviceToRoom(node, roomId);
      setAssigningNode(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setError(`Could not assign room to ${node}`);
    } finally {
      setActionNode(null);
    }
  }

  async function handleClear(node: string) {
    try {
      setActionNode(node);
      setError(null);
      await clearDeviceRoom(node);
      await loadData();
    } catch (err) {
      console.error(err);
      setError(`Could not unassign ${node}`);
    } finally {
      setActionNode(null);
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeCount = devices.filter((d) => d.is_active).length;
  const groupedRooms = groupRoomsByBuilding(rooms);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page">
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          Loading devices…
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">📡 Device Scanner</h1>
          <p className="page-subtitle">
            Assign ESP32 devices to rooms. Scans are tagged automatically — no start/stop needed.
          </p>
        </div>
        <button className="button button-secondary" onClick={() => void loadData()}>
          ↻ Refresh
        </button>
      </header>

      {error && (
        <div
          style={{
            background: "var(--error-bg, #fee2e2)",
            color: "var(--error-text, #991b1b)",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {/* Metrics */}
      <section className="metrics-row">
        <div className="metric-card metric-card-green">
          <div className="metric-card-title">Active Devices</div>
          <div className="metric-card-value">{activeCount}</div>
        </div>
        <div className="metric-card metric-card-blue">
          <div className="metric-card-title">Total Devices</div>
          <div className="metric-card-value">{devices.length}</div>
        </div>
        <div className="metric-card metric-card-purple">
          <div className="metric-card-title">Available Rooms</div>
          <div className="metric-card-value">{rooms.length}</div>
        </div>
      </section>

      {/* How it works callout */}
      <div
        style={{
          background: "var(--surface-2, #f8fafc)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "10px",
          padding: "14px 18px",
          marginBottom: "24px",
          fontSize: "14px",
          color: "var(--text-muted)",
        }}
      >
        <strong style={{ color: "var(--text)" }}>How it works: </strong>
        Select a room from the dropdown next to each device and click <strong>Assign</strong>.
        The device will tag every scan with that room until you click <strong>Clear</strong> or reassign it.
        New devices appear here automatically as soon as they send their first scan.
      </div>

      {/* Device cards */}
      {devices.length === 0 ? (
        <div
          className="table-card"
          style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📡</div>
          <p style={{ fontWeight: "600", marginBottom: "6px" }}>No devices yet</p>
          <p style={{ fontSize: "14px" }}>
            Power on an ESP32 and it will appear here once it sends its first scan.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "16px",
          }}
        >
          {devices.map((device) => (
            <DeviceCard
              key={device.node}
              device={device}
              groupedRooms={groupedRooms}
              isAssigning={assigningNode === device.node}
              isActioning={actionNode === device.node}
              selectedRoomId={selectedRoom[device.node] ?? null}
              onSelectRoom={(roomId) =>
                setSelectedRoom((prev) => ({ ...prev, [device.node]: roomId }))
              }
              onOpenAssign={() => setAssigningNode(device.node)}
              onCancelAssign={() => setAssigningNode(null)}
              onAssign={() => void handleAssign(device.node)}
              onClear={() => void handleClear(device.node)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── DeviceCard sub-component ──────────────────────────────────────────────────

type DeviceCardProps = {
  device: Device;
  groupedRooms: GroupedRooms[];
  isAssigning: boolean;
  isActioning: boolean;
  selectedRoomId: number | null;
  onSelectRoom: (roomId: number) => void;
  onOpenAssign: () => void;
  onCancelAssign: () => void;
  onAssign: () => void;
  onClear: () => void;
};

function DeviceCard({
  device,
  groupedRooms,
  isAssigning,
  isActioning,
  selectedRoomId,
  onSelectRoom,
  onOpenAssign,
  onCancelAssign,
  onAssign,
  onClear,
}: DeviceCardProps) {
  const isActive = device.is_active;

  return (
    <div
      className="table-card"
      style={{
        padding: "20px",
        borderLeft: `4px solid ${isActive ? "var(--success, #22c55e)" : "var(--border, #e2e8f0)"}`,
        transition: "border-color 0.2s",
      }}
    >
      {/* Top row — node name + status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>📡</span>
          <span style={{ fontWeight: "700", fontFamily: "monospace", fontSize: "15px" }}>
            {device.node}
          </span>
        </div>
        <span
          className={`badge ${isActive ? "badge-success" : "badge-muted"}`}
          style={{ fontSize: "12px" }}
        >
          {isActive ? "● Scanning" : "○ Idle"}
        </span>
      </div>

      {/* Current assignment */}
      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
        {isActive ? (
          <>
            <div>
              <span style={{ color: "var(--text)" }}>Room: </span>
              <strong>{device.room_name}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text)" }}>Building: </span>
              {device.building_name}
            </div>
            <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
              Assigned {new Date(device.assigned_at).toLocaleString()}
            </div>
          </>
        ) : (
          <span style={{ fontStyle: "italic" }}>No room assigned — scans are untagged</span>
        )}
      </div>

      {/* Actions */}
      {isAssigning ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <select
            className="input"
            value={selectedRoomId ?? ""}
            onChange={(e) => onSelectRoom(Number(e.target.value))}
            style={{ width: "100%", fontSize: "13px" }}
          >
            <option value="">— Select a room —</option>
            {groupedRooms.map((group) => (
              <optgroup key={group.building_id} label={group.building_name}>
                {group.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                    {room.floor ? ` · ${room.floor}` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="button button-primary"
              style={{ flex: 1 }}
              disabled={!selectedRoomId || isActioning}
              onClick={onAssign}
            >
              {isActioning ? "Assigning…" : "Assign"}
            </button>
            <button className="button button-secondary" onClick={onCancelAssign}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="button button-primary"
            style={{ flex: 1 }}
            onClick={onOpenAssign}
            disabled={isActioning}
          >
            {isActive ? "Reassign Room" : "Assign Room"}
          </button>
          {isActive && (
            <button
              className="button button-secondary"
              onClick={onClear}
              disabled={isActioning}
              style={{ color: "var(--error-text, #dc2626)" }}
            >
              {isActioning ? "…" : "Clear"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}