// components/admin/BuildingCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import type { Building } from "@/lib/api";
import { updateBuilding, deleteBuilding } from "@/lib/api";

interface BuildingCardProps {
  building: Building;
  onUpdate: (building: Building) => void;
  onDelete: (buildingId: number) => void;
}

export function BuildingCard({ building, onUpdate, onDelete }: BuildingCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    const name = window.prompt("Building name:", building.name);
    if (name === null) return;
    
    const description = window.prompt("Building description:", building.description || "");
    if (description === null) return;

    try {
      setBusy(true);
      const updated = await updateBuilding(building.id, { name, description });
      onUpdate(updated);
    } catch (err) {
      console.error(err);
      alert("Failed to update building");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm(`Delete building "${building.name}"? This will also delete all rooms in this building.`)) {
      return;
    }

    try {
      setBusy(true);
      await deleteBuilding(building.id);
      onDelete(building.id);
    } catch (err) {
      console.error(err);
      alert("Failed to delete building");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="building-card" onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
      <Link href={`/admin/buildings/${building.id}/rooms`} className="building-card-link">
        <div className="building-card-icon">🏢</div>

        <div className="building-card-content">
          <h3 className="building-card-title">{building.name}</h3>
          {building.description && (
            <p className="building-card-description">{building.description}</p>
          )}
        </div>

        <div className="building-card-chevron">›</div>
      </Link>
      
      {showActions && (
        <div className="building-card-actions">
          <button
            type="button"
            className="button button-small button-secondary"
            onClick={handleEdit}
            disabled={busy}
          >
            Edit
          </button>
          <button
            type="button"
            className="button button-small button-danger"
            onClick={handleDelete}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}