"use client";

import { useState, useEffect, use } from "react";
import { fetchBuildingFloorPlans, uploadFloorPlan, createFloorPlanFromUrl, getImageUrl, type BuildingFloorPlans, type FloorPlan } from "../../../../../lib/api";

interface FloorPlansPageProps {
  params: Promise<{
    buildingId: string;
  }>;
}

export default function FloorPlansPage({ params }: FloorPlansPageProps) {
  const resolvedParams = use(params);
  const [data, setData] = useState<BuildingFloorPlans | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlan | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "url">("file");
  const [uploading, setUploading] = useState(false);
  const [floorName, setFloorName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const buildingId = parseInt(resolvedParams.buildingId);

  useEffect(() => {
    loadFloorPlans();
  }, [buildingId]);

  async function loadFloorPlans() {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchBuildingFloorPlans(buildingId);
      setData(result);
      
      if (result.floorplans.length > 0) {
        setSelectedFloorPlan(result.floorplans[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load floor plans");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!floorName.trim()) {
      setError("Floor name is required");
      return;
    }

    if (uploadType === "file" && !selectedFile) {
      setError("Please select a file");
      return;
    }

    if (uploadType === "url" && !imageUrl.trim()) {
      setError("Image URL is required");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      let newFloorPlan: FloorPlan;
      if (uploadType === "file" && selectedFile) {
        newFloorPlan = await uploadFloorPlan(buildingId, floorName, selectedFile);
      } else {
        newFloorPlan = await createFloorPlanFromUrl(buildingId, floorName, imageUrl);
      }

      // Reset form and reload data
      setFloorName("");
      setImageUrl("");
      setSelectedFile(null);
      setShowUploadForm(false);
      await loadFloorPlans();
      
      // Select the newly added floor plan
      setSelectedFloorPlan(newFloorPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload floor plan");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading floor plans…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <button
          className="link-back"
          onClick={() => history.back()}
          type="button"
        >
          ← Back to Rooms
        </button>

        <h1 className="page-title">
          Floor Plans - {data?.building.name || "Building"}
        </h1>

        <div className="page-actions">
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="button button-primary"
            type="button"
          >
            {showUploadForm ? "Cancel" : "+ Add Floor Plan"}
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2 className="modal-title">Add Floor Plan</h2>
            
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Upload Type:</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="file"
                      checked={uploadType === "file"}
                      onChange={(e) => setUploadType(e.target.value as "file" | "url")}
                    />
                    Upload Image
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="url"
                      checked={uploadType === "url"}
                      onChange={(e) => setUploadType(e.target.value as "file" | "url")}
                    />
                    Paste Image URL
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="floor-name">
                  Floor Name
                </label>
                <input
                  id="floor-name"
                  className="input"
                  value={floorName}
                  onChange={(e) => setFloorName(e.target.value)}
                  placeholder="e.g., Ground Floor, First Floor"
                />
              </div>

              {uploadType === "file" ? (
                <div className="form-group">
                  <label className="form-label" htmlFor="file-input">
                    Select Image File
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="input"
                  />
                  <p className="form-help">Supported formats: PNG, JPEG</p>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label" htmlFor="image-url">
                    Image URL
                  </label>
                  <input
                    id="image-url"
                    type="url"
                    className="input"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/floorplan.png"
                  />
                  <p className="form-help">Any valid image URL (PNG, JPEG, etc.)</p>
                </div>
              )}

              <div className="modal-footer">
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setError(null);
                  }}
                  className="button button-secondary"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="button button-primary"
                  type="button"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floor Plans Display */}
      {!data || data.floorplans.length === 0 ? (
        <div className="empty-state">
          <h2>No floor plans yet</h2>
          <p>Use "Add Floor Plan" to upload your first floor plan.</p>
        </div>
      ) : (
        <>
          {/* Floor Selection */}
          {data.floorplans.length > 1 && (
            <div className="form-group">
              <label htmlFor="floor-select" className="form-label">
                Select Floor:
              </label>
              <select
                id="floor-select"
                value={selectedFloorPlan?.id || ""}
                onChange={(e) => {
                  const floorPlan = data.floorplans.find(fp => fp.id === parseInt(e.target.value));
                  setSelectedFloorPlan(floorPlan || null);
                }}
                className="input"
              >
                {data.floorplans.map((fp) => (
                  <option key={fp.id} value={fp.id}>
                    {fp.floor_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Floor Plan Display */}
          {selectedFloorPlan && (
            <div className="floorplan-display">
              <h2 className="floorplan-title">
                {selectedFloorPlan.floor_name}
              </h2>
              <p className="floorplan-date">
                Created: {new Date(selectedFloorPlan.created_at).toLocaleDateString()}
              </p>
              <div className="floorplan-image-container">
                <img
                  src={getImageUrl(selectedFloorPlan.image_url)}
                  alt={`Floor plan for ${selectedFloorPlan.floor_name}`}
                  className="floorplan-image"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}