import { API_BASE, handleJson } from "./http";
import type { Room } from "./types";

export async function fetchRooms(buildingId?: number): Promise<Room[]> {
  const url =
    buildingId != null
      ? `${API_BASE}/rooms?building_id=${buildingId}`
      : `${API_BASE}/rooms`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await handleJson<{ rooms: Room[] }>(res);
  return data.rooms ?? [];
}

export async function createRoom(payload: {
  name: string;
  building_id: number;
  floor?: string;
  room_type?: string;
}): Promise<Room> {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ room: Room }>(res);
  return data.room;
}

export async function updateRoom(
  roomId: number,
  payload: {
    name?: string;
    building_id?: number;
    floor?: string;
    room_type?: string;
  }
): Promise<Room> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ room: Room }>(res);
  return data.room;
}

export async function deleteRoom(roomId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed: ${res.status} ${text}`);
  }
}

export async function updateRoomPosition(
  roomId: number,
  payload: {
    floorplan_id: number;
    x: number;
    y: number;
  }
): Promise<void> {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/position`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Update position failed: ${res.status} ${text}`);
  }
}
