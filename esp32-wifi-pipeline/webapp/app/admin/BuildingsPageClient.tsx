// components/admin/BuildingsPageClient.tsx
"use client";

import { useState } from "react";
import React from "react";
import { BuildingCard } from "@/components/admin/BuildingCard";
import { createBuilding, type Building } from "@/lib/api";

interface Props {
  initialBuildings: Building[];
}

export function BuildingsPageClient({ initialBuildings }: Props) {
  const [buildings, setBuildings] = useState<Building[]>(initialBuildings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddBuilding() {
    const name = window.prompt("Building name:");
    if (!name) return;

    const description = window.prompt(
      "Building description (optional):"
    ) ?? undefined;

    try {
      setBusy(true);
      setError(null);
      const newBuilding = await createBuilding({ name, description });
      setBuildings((prev) => [...prev, newBuilding]);
    } catch (err) {
      console.error(err);
      setError("Failed to create building");
    } finally {
      setBusy(false);
    }
  }

  function handleUpdateBuilding(updatedBuilding: Building) {
    setBuildings((prev) =>
      prev.map((b) => (b.id === updatedBuilding.id ? updatedBuilding : b))
    );
  }

  function handleDeleteBuilding(buildingId: number) {
    setBuildings((prev) => prev.filter((b) => b.id !== buildingId));
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Buildings Management</h1>
          <p className="page-subtitle">
            Manage your building infrastructure
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={handleAddBuilding}
          disabled={busy}
        >
          {busy ? "Adding…" : "+ Add Building"}
        </button>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {buildings.length === 0 ? (
        <div className="empty-state">
          <h2>No buildings yet</h2>
          <p>Use “Add Building” to create your first building.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {buildings.map((b) => (
            <BuildingCard 
              key={b.id} 
              building={b} 
              onUpdate={handleUpdateBuilding}
              onDelete={handleDeleteBuilding}
            />
          ))}
        </div>
      )}
    </div>
  );
}