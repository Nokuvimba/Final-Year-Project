// app/admin/buildings/page.tsx
// app/admin/buildings/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  fetchBuildings,
  createBuilding,
  type Building,
} from "@/lib/api";
import { BuildingCard } from "@/components/admin/BuildingCard";

export default function AdminBuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadBuildings() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBuildings();
      setBuildings(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load buildings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBuildings();
  }, []);

  function openAddBuilding() {
    setNewName("");
    setNewDescription("");
    setIsAddOpen(true);
  }

  function closeAddBuilding() {
    if (saving) return; // don't close while saving
    setIsAddOpen(false);
  }

  async function handleAddBuildingSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!newName.trim()) {
      setError("Building name is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await createBuilding({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });

      setIsAddOpen(false);
      await loadBuildings();
    } catch (err) {
      console.error(err);
      setError("Could not create building");
    } finally {
      setSaving(false);
    }
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
          onClick={openAddBuilding}
        >
          + Add Building
        </button>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading buildings…</p>
      ) : buildings.length === 0 ? (
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
              onUpdate={(updated) => {
                setBuildings(prev => prev.map(building => 
                  building.id === updated.id ? updated : building
                ));
              }}
              onDelete={(buildingId) => {
                setBuildings(prev => prev.filter(building => building.id !== buildingId));
              }}
            />
          ))}
        </div>
      )}

      {/* Add Building Modal */}
      {isAddOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2 className="modal-title">Add New Building</h2>

            <form
              onSubmit={handleAddBuildingSubmit}
              className="modal-form"
            >
              <label className="form-field">
                <span className="form-label">Building Name</span>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g., Science Building"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>

              <label className="form-field">
                <span className="form-label">Description</span>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Brief description of the building..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={closeAddBuilding}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                >
                  {saving ? "Adding…" : "Add Building"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}