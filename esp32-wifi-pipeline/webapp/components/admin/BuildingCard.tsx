// components/admin/BuildingCard.tsx
import Link from "next/link";
import type { Building } from "@/lib/api";

interface BuildingCardProps {
  building: Building;
}

export function BuildingCard({ building }: BuildingCardProps) {
  return (
    <Link href={`/admin/buildings/${building.id}/rooms`} className="building-card">
      <div className="building-card-icon">🏢</div>

      <div className="building-card-content">
        <h3 className="building-card-title">{building.name}</h3>
        {building.description && (
          <p className="building-card-description">{building.description}</p>
        )}
      </div>

      <div className="building-card-chevron">›</div>
    </Link>
  );
}