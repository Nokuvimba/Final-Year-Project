// app/admin/rooms/[roomId]/page.tsx
import { AdminRoomWifiClient } from "./AdminRoomWifiClient";

type Props = {
  params: { roomId: string };
};

export default async function AdminRoomWifiPage({ params }: Props) {
  const resolvedParams = await params;
  const roomId = Number(resolvedParams.roomId);
  
  if (isNaN(roomId)) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Invalid room ID</h2>
        </div>
      </div>
    );
  }

  return <AdminRoomWifiClient roomId={roomId} />;
}