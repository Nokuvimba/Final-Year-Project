"use client";

import { useState, useEffect, use, useRef, type MouseEvent } from "react";
import { fetchBuildingFloorPlans, fetchRooms, uploadFloorPlan, createFloorPlanFromUrl, updateFloorPlan, deleteFloorPlan, updateRoomPosition, getImageUrl, type BuildingFloorPlans, type FloorPlan, type Room } from "../../../../../lib/api";

interface FloorPlansPageProps {
  params: Promise<{
    buildingId: string;
  }>;
}

export default function FloorPlansPage({ params }: FloorPlansPageProps) {
  const resolvedParams = use(params);
  const [data, setData] = useState<BuildingFloorPlans | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [clickMessage, setClickMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlan | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingFloorPlan, setEditingFloorPlan] = useState<FloorPlan | null>(null);
  const [uploadType, setUploadType] = useState<"file" | "url">("file");
  const [uploading, setUploading] = useState(false);
  const [floorName, setFloorName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);

  const buildingId = parseInt(resolvedParams.buildingId);

  useEffect(() => {
    loadFloorPlans();
    loadRooms();
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

  async function loadRooms() {
    try {
      const roomsData = await fetchRooms(buildingId);
      setRooms(roomsData);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    }
  }

  async function handleUpload() {
    if (!floorName.trim()) {
      setError("Floor name is required");
      return;
    }

    if (uploadType === "file" && !selectedFile && !editingFloorPlan) {
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
      if (editingFloorPlan) {
        // Update existing floor plan
        newFloorPlan = await updateFloorPlan(
          editingFloorPlan.id,
          buildingId,
          floorName,
          uploadType === "url" ? imageUrl : undefined
        );
      } else {
        // Create new floor plan
        if (uploadType === "file" && selectedFile) {
          newFloorPlan = await uploadFloorPlan(buildingId, floorName, selectedFile);
        } else {
          newFloorPlan = await createFloorPlanFromUrl(buildingId, floorName, imageUrl);
        }
      }

      // Reset form and reload data
      resetForm();
      await loadFloorPlans();
      
      // Select the newly added/updated floor plan
      setSelectedFloorPlan(newFloorPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save floor plan");
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setFloorName("");
    setImageUrl("");
    setSelectedFile(null);
    setShowUploadForm(false);
    setEditingFloorPlan(null);
  }

  function handleEdit(floorPlan: FloorPlan) {
    setEditingFloorPlan(floorPlan);
    setFloorName(floorPlan.floor_name);
    setImageUrl(floorPlan.image_url.startsWith("http") ? floorPlan.image_url : "");
    setUploadType(floorPlan.image_url.startsWith("http") ? "url" : "file");
    setShowUploadForm(true);
  }

  async function handleDelete(floorPlan: FloorPlan) {
    if (!window.confirm(`Delete floor plan "${floorPlan.floor_name}"?`)) {
      return;
    }

    try {
      setError(null);
      await deleteFloorPlan(floorPlan.id);
      await loadFloorPlans();
      
      // Clear selection if deleted floor plan was selected
      if (selectedFloorPlan?.id === floorPlan.id) {
        setSelectedFloorPlan(data?.floorplans[0] || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete floor plan");
    }
  }

  // Click handler for placing rooms on floor plan
async function handleFloorPlanClick(event: MouseEvent<HTMLImageElement>) {
    // Clear any previous click message
    setClickMessage(null);
    
    // Check if a room is selected for placement
    if (!activeRoom) {
      setClickMessage("Select a room first");
      // Auto-clear message after 3 seconds
      setTimeout(() => setClickMessage(null), 3000);
      return;
    }

    // Check if we have a valid floor plan and image reference
    if (!selectedFloorPlan || !imgRef.current) {
      return;
    }

    try {
      // Get the bounding rectangle of the image element
      // This gives us the actual rendered size and position of the image on screen
      const rect = imgRef.current.getBoundingClientRect();
      
      // Calculate the click position relative to the image
      // We subtract rect.left/top to get coordinates relative to the image's top-left corner
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      
      // Normalize coordinates to [0,1] range
      // We divide by the actual rendered width/height to get a percentage
      // This makes the coordinates independent of the image's display size
      let x = clickX / rect.width;
      let y = clickY / rect.height;
      
      // Clamp coordinates to valid range [0,1]
      // This ensures we don't send invalid coordinates if click is slightly outside image bounds
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      
      // Call the API to update the room's position
      await updateRoomPosition(activeRoom.id, {
        floorplan_id: selectedFloorPlan.id,
        x: x,
        y: y
      });
      
      // Update the local room state immediately so the marker appears without refresh
      // Find the room in our local state and update its position
      setRooms(prevRooms => 
        prevRooms.map(room => 
          room.id === activeRoom.id 
            ? { ...room, x, y, floorplan_id: selectedFloorPlan.id }
            : room
        )
      );
      
      // Show success message
      setClickMessage(`Placed "${activeRoom.name}" at position (${Math.round(x * 100)}%, ${Math.round(y * 100)}%)`);
      setTimeout(() => setClickMessage(null), 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place room");
    }
  }

  // Get rooms that match the current floor
  const floorRooms = selectedFloorPlan 
    ? rooms.filter(room => room.floor === selectedFloorPlan.floor_name)
    : [];

  // Get rooms that are positioned on the current floor plan
  const positionedRooms = selectedFloorPlan
    ? rooms.filter(room => 
        room.floorplan_id === selectedFloorPlan.id && 
        room.x !== null && 
        room.y !== null
      )
    : [];

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
            <h2 className="modal-title">{editingFloorPlan ? "Edit Floor Plan" : "Add Floor Plan"}</h2>
            
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
                    Select Image File {editingFloorPlan && "(optional - leave empty to keep current image)"}
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
                    resetForm();
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
                  {uploading ? (editingFloorPlan ? "Updating…" : "Uploading…") : (editingFloorPlan ? "Update" : "Upload")}
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
              <div className="floorplan-header">
                <div>
                  <h2 className="floorplan-title">
                    {selectedFloorPlan.floor_name}
                  </h2>
                  <p className="floorplan-date">
                    Created: {new Date(selectedFloorPlan.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="floorplan-actions">
                  <button
                    onClick={() => handleEdit(selectedFloorPlan)}
                    className="button button-secondary button-small"
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(selectedFloorPlan)}
                    className="button button-danger button-small"
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Room Selection */}
              {floorRooms.length > 0 && (
                <div className="room-placement-section">
                  <h3 className="section-title">Place Rooms on Floor Plan</h3>
                  <div className="form-group">
                    <label htmlFor="room-select" className="form-label">
                      Select Room to Place:
                    </label>
                    <select
                      id="room-select"
                      value={activeRoom?.id || ""}
                      onChange={(e) => {
                        const room = floorRooms.find(r => r.id === parseInt(e.target.value));
                        setActiveRoom(room || null);
                        setClickMessage(null);
                      }}
                      className="input"
                    >
                      <option value="">-- Select a room --</option>
                      {floorRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name} {room.room_type && `(${room.room_type})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  {clickMessage && (
                    <div className="click-message">
                      {clickMessage}
                    </div>
                  )}
                  <p className="form-help">
                    {activeRoom 
                      ? `Click on the floor plan to place "${activeRoom.name}"`
                      : "Select a room above, then click on the floor plan to place it"
                    }
                  </p>
                </div>
              )}

              {/* Floor Plan Image with Markers */}
              <div className="floorplan-image-container" style={{ position: 'relative' }}>
                <img
                  ref={imgRef}
                  src={getImageUrl(selectedFloorPlan.image_url)}
                  alt={`Floor plan for ${selectedFloorPlan.floor_name}`}
                  className="floorplan-image"
                  onClick={handleFloorPlanClick}
                  style={{ cursor: activeRoom ? 'crosshair' : 'default' }}
                />
                
                {/* Room Markers */}
                {positionedRooms.map((room) => (
                  <div
                    key={room.id}
                    className="room-marker"
                    style={{
                      position: 'absolute',
                      left: `${(room.x || 0) * 100}%`,
                      top: `${(room.y || 0) * 100}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    title={`${room.name} ${room.room_type ? `(${room.room_type})` : ''}`}
                  >
                    <div className="room-marker-dot"></div>
                    <div className="room-marker-label">{room.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}