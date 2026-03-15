"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ScanPointCanvas from "@/components/floorplan/ScanPointCanvas";
import FloorplanHeatmapViewer from "@/components/floorplan/FloorplanHeatmapViewer";
import {
  fetchBuildings,
  fetchBuildingFloorPlans,
  createBuilding,
  fetchScanPoints,
  fetchDevices,
  assignDeviceToPoint,
  clearDevicePoint,
  updateScanPoint,
  deleteScanPoint,
  uploadFloorPlan,
  type Building,
  type FloorPlan,
  type ScanPoint,
  type Device,
} from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

type Mode = "edit" | "view";

// ═════════════════════════════════════════════════════════════════════════════
// AdminStudioClient
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminStudioClient() {

  // ── Data ───────────────────────────────────────────────────────────────────
  const [buildings,         setBuildings]         = useState<Building[]>([]);
  const [selectedBuilding,  setSelectedBuilding]  = useState<Building | null>(null);
  const [floorplans,        setFloorplans]        = useState<FloorPlan[]>([]);
  const [selectedFloorplan, setSelectedFloorplan] = useState<FloorPlan | null>(null);
  const [scanPoints,        setScanPoints]        = useState<ScanPoint[]>([]);
  const [devices,           setDevices]           = useState<Device[]>([]);
  const [selectedPoint,     setSelectedPoint]     = useState<ScanPoint | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [mode,          setMode]          = useState<Mode>("edit");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [labelDraft,    setLabelDraft]    = useState("");
  const [savingLabel,   setSavingLabel]   = useState(false);
  const [deletingPoint, setDeletingPoint] = useState(false);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showFloorModal,    setShowFloorModal]    = useState(false);
  const [newBuildingName,   setNewBuildingName]   = useState("");
  const [newBuildingDesc,   setNewBuildingDesc]   = useState("");
  const [creatingBuilding,  setCreatingBuilding]  = useState(false);
  const [newFloorName,      setNewFloorName]      = useState("");
  const [floorFile,         setFloorFile]         = useState<File | null>(null);
  const [uploadingFloor,    setUploadingFloor]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchBuildings();
        setBuildings(data);
        if (data.length > 0) await doSelectBuilding(data[0]);
      } finally { setLoading(false); }
    })();
  }, []);

  // Reload devices when right panel opens on a point
  useEffect(() => {
    if (selectedPoint) {
      fetchDevices().then(setDevices).catch(console.error);
      setLabelDraft(selectedPoint.label ?? "");
    }
  }, [selectedPoint?.id]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function doSelectBuilding(b: Building) {
    setSelectedBuilding(b);
    setSelectedPoint(null);
    setSelectedFloorplan(null);
    setScanPoints([]);
    setSearchQuery("");
    setShowDropdown(false);
    try {
      const res = await fetchBuildingFloorPlans(b.id);
      const fps = res.floorplans ?? [];
      setFloorplans(fps);
      if (fps.length > 0) await doSelectFloorplan(fps[0]);
    } catch (e) { console.error(e); }
  }

  const doSelectFloorplan = useCallback(async (fp: FloorPlan) => {
    setSelectedFloorplan(fp);
    setSelectedPoint(null);
    try {
      const pts = await fetchScanPoints(fp.id);
      setScanPoints(pts);
    } catch (e) { console.error(e); }
  }, []);

  async function handleSaveLabel() {
    if (!selectedPoint) return;
    setSavingLabel(true);
    try {
      const updated = await updateScanPoint(selectedPoint.id, { label: labelDraft || undefined });
      setScanPoints(prev => prev.map(p => p.id === updated.id ? updated : p));
      setSelectedPoint(updated);
    } catch (e) { console.error(e); }
    finally { setSavingLabel(false); }
  }

  async function handleAssignDevice(node: string) {
    if (!selectedPoint) return;
    try {
      if (node === "") {
        const current = devices.find(d => d.scan_point_id === selectedPoint.id);
        if (current) await clearDevicePoint(current.node);
      } else {
        await assignDeviceToPoint(node, selectedPoint.id);
      }
      const [updatedDevices, updatedPts] = await Promise.all([
        fetchDevices(),
        fetchScanPoints(selectedPoint.floorplan_id),
      ]);
      setDevices(updatedDevices);
      setScanPoints(updatedPts);
      const refreshed = updatedPts.find(p => p.id === selectedPoint.id);
      if (refreshed) setSelectedPoint(refreshed);
    } catch (e) { console.error(e); }
  }

  async function handleDeletePoint() {
    if (!selectedPoint) return;
    setDeletingPoint(true);
    try {
      await deleteScanPoint(selectedPoint.id);
      setScanPoints(prev => prev.filter(p => p.id !== selectedPoint.id));
      setSelectedPoint(null);
    } catch (e) { console.error(e); }
    finally { setDeletingPoint(false); }
  }

  async function handleCreateBuilding() {
    if (!newBuildingName.trim()) return;
    setCreatingBuilding(true);
    try {
      const b = await createBuilding({ name: newBuildingName.trim(), description: newBuildingDesc.trim() || undefined });
      setBuildings(prev => [...prev, b]);
      setShowBuildingModal(false);
      setNewBuildingName(""); setNewBuildingDesc("");
      await doSelectBuilding(b);
    } catch (e) { console.error(e); }
    finally { setCreatingBuilding(false); }
  }

  async function handleUploadFloor() {
    if (!selectedBuilding || !floorFile || !newFloorName.trim()) return;
    setUploadingFloor(true);
    try {
      const fp = await uploadFloorPlan(selectedBuilding.id, newFloorName.trim(), floorFile);
      setFloorplans(prev => [...prev, fp]);
      setShowFloorModal(false);
      setNewFloorName(""); setFloorFile(null);
      await doSelectFloorplan(fp);
    } catch (e) { console.error(e); }
    finally { setUploadingFloor(false); }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredBuildings = buildings.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const assignedDevice  = selectedPoint ? devices.find(d => d.scan_point_id === selectedPoint.id) ?? null : null;
  const assignedCount   = devices.filter(d => d.is_active).length;

  // ═══════════════════════════════════════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={css.root}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header style={css.topBar}>

        <Logo />

        {/* Building search */}
        <div style={{ position:"relative", width:400 }}>
          <SearchIcon />
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
            placeholder={selectedBuilding?.name ?? "Search buildings…"}
            style={css.searchInput}
          />
          {showDropdown && filteredBuildings.length > 0 && (
            <div style={css.dropdown}>
              {filteredBuildings.map(b => (
                <button key={b.id} onMouseDown={() => doSelectBuilding(b)}
                  style={{ ...css.dropdownItem, background: selectedBuilding?.id === b.id ? "rgba(29,78,216,0.15)" : "none" }}>
                  <div style={{ fontWeight:600 }}>{b.name}</div>
                  {b.description && <div style={css.dropdownSub}>{b.description}</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={css.topBarRight}>
          <ModeToggle mode={mode} onChange={setMode} />
          {selectedBuilding && (
            <GhostBtn onClick={() => setShowFloorModal(true)}>+ Floor Plan</GhostBtn>
          )}
          <GhostBtn onClick={() => setShowBuildingModal(true)}>+ Building</GhostBtn>
          <span style={css.adminBadge}>ADMIN</span>
        </div>
      </header>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div style={css.body}>

        {/* LEFT — canvas */}
        <div style={css.leftPane}>

          {/* Floor selector tabs */}
          {floorplans.length > 1 && (
            <div style={css.floorTabs}>
              {floorplans.map(fp => (
                <button key={fp.id} onClick={() => doSelectFloorplan(fp)}
                  style={{ ...css.floorTab, ...(selectedFloorplan?.id === fp.id ? css.floorTabActive : {}) }}>
                  {fp.floor_name}
                </button>
              ))}
            </div>
          )}

          <div style={css.canvasArea}>
            {/* Breadcrumb */}
            <div style={css.breadcrumb}>
              <span style={css.breadcrumbBuilding}>{selectedBuilding?.name ?? "—"}</span>
              {selectedFloorplan && <><span style={css.breadcrumbSep}>›</span><span style={css.breadcrumbFloor}>{selectedFloorplan.floor_name}</span></>}
              <span style={{ marginLeft:"auto", color:"#334155", fontSize:"0.73rem" }}>
                {scanPoints.length} point{scanPoints.length !== 1 ? "s" : ""} · {mode === "edit" ? "Edit mode" : "Signal view"}
              </span>
            </div>

            {loading ? (
              <EmptyCanvas icon="⟳" title="Loading…" sub="" />
            ) : !selectedBuilding ? (
              <EmptyCanvas icon="🏢" title="No building selected" sub="Search for a building above or create one with + Building." />
            ) : !selectedFloorplan ? (
              <EmptyCanvas icon="🗺️" title="No floor plan" sub="Upload a floor plan image with + Floor Plan to start placing scan points." />
            ) : mode === "edit" ? (
              <ScanPointCanvas
                floorplanId={selectedFloorplan.id}
                floorplanImageUrl={getImageUrl(selectedFloorplan.image_url)}
                scanPoints={scanPoints}
                selectedPointId={selectedPoint?.id ?? null}
                onPointCreated={pt => { setScanPoints(p => [...p, pt]); setSelectedPoint(pt); }}
                onPointSelected={setSelectedPoint}
                onPointUpdated={pt => { setScanPoints(p => p.map(x => x.id === pt.id ? pt : x)); setSelectedPoint(pt); }}
                onPointDeleted={id => { setScanPoints(p => p.filter(x => x.id !== id)); setSelectedPoint(null); }}
              />
            ) : (
              <FloorplanHeatmapViewer
                floorplanId={selectedFloorplan.id}
                floorplanImageUrl={getImageUrl(selectedFloorplan.image_url)}
                readOnly={true}
              />
            )}
          </div>
        </div>

        {/* RIGHT — detail panel */}
        <aside style={css.rightPane}>
          <div style={{ flex:1, overflowY:"auto", padding:"1rem" }}>

            <div style={css.panelHeader}>
              <div style={css.panelTitle}>
                {selectedPoint ? `Scan Point #${selectedPoint.id}` : "Detail Panel"}
              </div>
              <div style={css.panelSub}>
                {selectedPoint ? "Edit label · assign device · view stats"
                  : mode === "edit" ? "Click the map to place or select a pin"
                  : "Switch to Edit mode to manage pins"}
              </div>
            </div>

            {!selectedPoint ? (
              <div style={css.panelEmpty}>
                <div style={css.panelEmptyIcon}>📍</div>
                <div style={css.panelEmptyTitle}>Nothing selected</div>
                <div style={css.panelEmptySub}>
                  {mode === "edit"
                    ? "Click the floor plan to place a scan point. Click an existing pin to select it."
                    : "Switch to Edit mode to interact with scan points."}
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"0.875rem" }}>

                {/* Coordinates */}
                <Card title="Position">
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
                    <Coord label="X" value={`${(selectedPoint.x * 100).toFixed(1)}%`} />
                    <Coord label="Y" value={`${(selectedPoint.y * 100).toFixed(1)}%`} />
                  </div>
                </Card>

                {/* Label */}
                <Card title="Label">
                  <div style={{ display:"flex", gap:"0.5rem" }}>
                    <input value={labelDraft}
                      onChange={e => setLabelDraft(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSaveLabel()}
                      placeholder='e.g. "Lab bench 3"'
                      style={css.labelInput} />
                    <button onClick={handleSaveLabel} disabled={savingLabel} style={css.saveBtn}>
                      {savingLabel ? "…" : "Save"}
                    </button>
                  </div>
                </Card>

                {/* Device assignment */}
                <Card title="Assigned Device">
                  <select value={assignedDevice?.node ?? ""} onChange={e => handleAssignDevice(e.target.value)}
                    style={{ ...css.select, color: assignedDevice ? "#60a5fa" : "#64748b" }}>
                    <option value="">— Unassigned —</option>
                    {assignedDevice && <option value={assignedDevice.node}>{assignedDevice.node} ✓</option>}
                    {devices.filter(d => d.node !== assignedDevice?.node).map(d => (
                      <option key={d.node} value={d.node} style={{ background:"#0f1929" }}>
                        {d.node}{d.scan_point_id !== selectedPoint.id ? ` (point #${d.scan_point_id})` : ""}
                      </option>
                    ))}
                  </select>
                  {assignedDevice && (
                    <div style={{ marginTop:"0.4rem", display:"flex", alignItems:"center", gap:"0.4rem" }}>
                      <span style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 7px #22c55e", display:"inline-block" }}/>
                      <span style={{ fontSize:"0.7rem", color:"#4ade80", fontWeight:600 }}>Live — scanning</span>
                    </div>
                  )}
                </Card>

                {/* Stats */}
                <Card title="Signal Stats">
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
                    <Stat label="Avg RSSI" value={selectedPoint.scan_count > 0 ? "— dBm" : "No data"} color="#3b82f6" />
                    <Stat label="Samples" value={String(selectedPoint.scan_count ?? 0)} color="#8b5cf6" />
                  </div>
                  {selectedPoint.scan_count === 0 && (
                    <p style={{ fontSize:"0.7rem", color:"#334155", marginTop:"0.5rem", lineHeight:1.5 }}>
                      Assign a device to start collecting scan data here.
                    </p>
                  )}
                </Card>

                {/* Delete */}
                <button onClick={handleDeletePoint} disabled={deletingPoint} style={css.deleteBtn}>
                  {deletingPoint ? "Deleting…" : "Delete Scan Point"}
                </button>
              </div>
            )}
          </div>

          {/* Status bar */}
          <div style={css.statusBar}>
            <span style={{ width:7, height:7, borderRadius:"50%", background: assignedCount > 0 ? "#22c55e" : "#475569", boxShadow: assignedCount > 0 ? "0 0 8px #22c55e" : "none", display:"inline-block", transition:"all 0.3s" }}/>
            <span style={{ fontSize:"0.7rem", color:"#475569" }}>
              {assignedCount > 0 ? `${assignedCount} device${assignedCount !== 1 ? "s" : ""} scanning` : "No devices assigned"}
              {selectedBuilding && ` · ${selectedBuilding.name}`}
            </span>
          </div>
        </aside>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      {showBuildingModal && (
        <ModalShell title="New Building" onClose={() => setShowBuildingModal(false)}>
          <input value={newBuildingName} onChange={e => setNewBuildingName(e.target.value)}
            placeholder="Building name *" autoFocus style={css.modalInput} />
          <input value={newBuildingDesc} onChange={e => setNewBuildingDesc(e.target.value)}
            placeholder="Description (optional)" style={css.modalInput} />
          <ModalFooter onCancel={() => setShowBuildingModal(false)} onConfirm={handleCreateBuilding}
            disabled={!newBuildingName.trim() || creatingBuilding}
            label={creatingBuilding ? "Creating…" : "Create Building"} />
        </ModalShell>
      )}

      {showFloorModal && (
        <ModalShell title="Upload Floor Plan" onClose={() => setShowFloorModal(false)}>
          <input value={newFloorName} onChange={e => setNewFloorName(e.target.value)}
            placeholder='Floor name, e.g. "Ground Floor"' autoFocus style={css.modalInput} />
          <div onClick={() => fileInputRef.current?.click()} style={css.dropZone}>
            <div style={{ fontSize:"1.5rem", marginBottom:"0.35rem" }}>🗺️</div>
            <div style={{ fontSize:"0.79rem", color: floorFile ? "#60a5fa" : "#64748b", fontWeight:600 }}>
              {floorFile ? floorFile.name : "Click to choose PNG or JPG"}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg"
            style={{ display:"none" }} onChange={e => setFloorFile(e.target.files?.[0] ?? null)} />
          <ModalFooter onCancel={() => setShowFloorModal(false)} onConfirm={handleUploadFloor}
            disabled={!newFloorName.trim() || !floorFile || uploadingFloor}
            label={uploadingFloor ? "Uploading…" : "Upload Floor Plan"} />
        </ModalShell>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Small components
// ═════════════════════════════════════════════════════════════════════════════

function Logo() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
      <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 18px rgba(59,130,246,0.45)", flexShrink:0 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" fill="white"/>
          <circle cx="8" cy="8" r="4.5" stroke="white" strokeWidth="1.1" strokeDasharray="2 1.5"/>
          <circle cx="8" cy="8" r="7" stroke="white" strokeOpacity="0.35" strokeWidth="0.9" strokeDasharray="2 2"/>
        </svg>
      </div>
      <span style={{ fontWeight:700, fontSize:"0.875rem", letterSpacing:"0.06em", color:"#f1f5f9" }}>Map Studio</span>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg style={{ position:"absolute", left:"0.75rem", top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:"#475569", zIndex:1 }} width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div style={{ display:"flex", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:9, padding:3, gap:2 }}>
      {(["edit","view"] as Mode[]).map(m => (
        <button key={m} onClick={() => onChange(m)}
          style={{ padding:"0.28rem 0.875rem", borderRadius:7, border:"none", cursor:"pointer", fontSize:"0.76rem", fontWeight:700, letterSpacing:"0.05em", textTransform:"capitalize", transition:"all 0.15s", background: mode === m ? "#1d4ed8" : "transparent", color: mode === m ? "#fff" : "#64748b", boxShadow: mode === m ? "0 0 14px rgba(29,78,216,0.5)" : "none" }}>
          {m}
        </button>
      ))}
    </div>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ height:32, padding:"0 0.7rem", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#94a3b8", fontSize:"0.78rem", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
      {children}
    </button>
  );
}

function EmptyCanvas({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"0.75rem", padding:"4rem 2rem", textAlign:"center" }}>
      <div style={{ fontSize:"2.8rem", opacity:0.25 }}>{icon}</div>
      <div style={{ fontSize:"0.875rem", fontWeight:600, color:"#475569" }}>{title}</div>
      {sub && <div style={{ fontSize:"0.76rem", color:"#334155", lineHeight:1.65, maxWidth:300 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"0.875rem" }}>
      <div style={{ fontSize:"0.67rem", fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:"0.6rem" }}>{title}</div>
      {children}
    </div>
  );
}

function Coord({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:7, padding:"0.38rem 0.6rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontSize:"0.67rem", color:"#64748b", fontWeight:700 }}>{label}</span>
      <span style={{ fontSize:"0.8rem", color:"#94a3b8", fontFamily:"monospace" }}>{value}</span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.025)", border:`1px solid ${color}28`, borderRadius:8, padding:"0.55rem 0.7rem" }}>
      <div style={{ fontSize:"0.64rem", color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:"0.95rem", fontWeight:700, color, fontFamily:"monospace" }}>{value}</div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" }}>
      <div style={{ background:"#0f1929", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:"1.75rem", width:420, display:"flex", flexDirection:"column", gap:"0.875rem", boxShadow:"0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ fontWeight:700, fontSize:"1rem", color:"#f1f5f9" }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, disabled, label }: { onCancel: () => void; onConfirm: () => void; disabled: boolean; label: string }) {
  return (
    <div style={{ display:"flex", gap:"0.5rem", justifyContent:"flex-end", marginTop:"0.25rem" }}>
      <button onClick={onCancel} style={{ padding:"0.5rem 1rem", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#94a3b8", fontSize:"0.82rem", cursor:"pointer" }}>Cancel</button>
      <button onClick={onConfirm} disabled={disabled} style={{ padding:"0.5rem 1.125rem", background:"#1d4ed8", border:"none", borderRadius:8, color:"#fff", fontSize:"0.82rem", fontWeight:700, cursor:"pointer", opacity: disabled ? 0.45 : 1, transition:"opacity 0.15s" }}>{label}</button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Styles object — keeps JSX clean
// ═════════════════════════════════════════════════════════════════════════════

const css: Record<string, React.CSSProperties> = {
  root:               { height:"100vh", display:"flex", flexDirection:"column", background:"#060d1a", color:"#e2e8f0", fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", overflow:"hidden" },
  topBar:             { height:56, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 1.25rem", borderBottom:"1px solid rgba(255,255,255,0.07)", background:"rgba(6,13,26,0.96)", backdropFilter:"blur(12px)", zIndex:30 },
  topBarRight:        { display:"flex", alignItems:"center", gap:"0.5rem" },
  searchInput:        { width:"100%", height:36, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, padding:"0 0.875rem 0 2.25rem", fontSize:"0.83rem", color:"#e2e8f0", outline:"none" },
  dropdown:           { position:"absolute", top:"calc(100% + 5px)", left:0, right:0, background:"#0f1929", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, boxShadow:"0 12px 40px rgba(0,0,0,0.6)", zIndex:50, maxHeight:220, overflowY:"auto" },
  dropdownItem:       { width:"100%", textAlign:"left", padding:"0.55rem 0.875rem", border:"none", borderBottom:"1px solid rgba(255,255,255,0.05)", color:"#e2e8f0", cursor:"pointer", fontSize:"0.83rem", display:"block" },
  dropdownSub:        { fontSize:"0.72rem", color:"#64748b", marginTop:2 },
  adminBadge:         { fontSize:"0.7rem", padding:"0.22rem 0.6rem", borderRadius:100, background:"rgba(29,78,216,0.15)", border:"1px solid rgba(29,78,216,0.3)", color:"#60a5fa", fontWeight:700, letterSpacing:"0.07em" },
  body:               { flex:1, display:"grid", gridTemplateColumns:"1fr 420px", overflow:"hidden" },
  leftPane:           { display:"flex", flexDirection:"column", overflow:"hidden", borderRight:"1px solid rgba(255,255,255,0.06)" },
  floorTabs:          { display:"flex", gap:3, padding:"0.45rem 1rem", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0, overflowX:"auto" },
  floorTab:           { padding:"0.28rem 0.875rem", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:"0.78rem", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s" },
  floorTabActive:     { borderColor:"#1d4ed8", background:"rgba(29,78,216,0.12)", color:"#60a5fa" },
  canvasArea:         { flex:1, padding:"1rem", overflow:"auto", display:"flex", flexDirection:"column" },
  breadcrumb:         { display:"flex", alignItems:"center", gap:"0.35rem", marginBottom:"0.75rem", flexShrink:0 },
  breadcrumbBuilding: { color:"#94a3b8", fontWeight:600, fontSize:"0.75rem" },
  breadcrumbSep:      { color:"#334155", fontSize:"0.75rem" },
  breadcrumbFloor:    { color:"#64748b", fontSize:"0.75rem" },
  rightPane:          { display:"flex", flexDirection:"column", overflow:"hidden", background:"rgba(255,255,255,0.012)" },
  panelHeader:        { marginBottom:"1rem", paddingBottom:"0.75rem", borderBottom:"1px solid rgba(255,255,255,0.07)" },
  panelTitle:         { fontWeight:700, fontSize:"0.875rem", color:"#f1f5f9" },
  panelSub:           { fontSize:"0.71rem", color:"#475569", marginTop:3 },
  panelEmpty:         { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"0.875rem", padding:"3rem 1rem", textAlign:"center" },
  panelEmptyIcon:     { fontSize:"1.75rem", width:54, height:54, borderRadius:15, background:"rgba(29,78,216,0.1)", border:"1px solid rgba(29,78,216,0.18)", display:"flex", alignItems:"center", justifyContent:"center" },
  panelEmptyTitle:    { fontSize:"0.83rem", fontWeight:600, color:"#475569" },
  panelEmptySub:      { fontSize:"0.73rem", color:"#334155", lineHeight:1.65, maxWidth:210 },
  labelInput:         { flex:1, height:34, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:7, padding:"0 0.75rem", color:"#e2e8f0", fontSize:"0.82rem", outline:"none" },
  saveBtn:            { padding:"0 0.75rem", height:34, background:"#1d4ed8", border:"none", borderRadius:7, color:"#fff", fontSize:"0.78rem", fontWeight:700, cursor:"pointer" },
  select:             { width:"100%", height:34, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:7, padding:"0 0.75rem", fontSize:"0.82rem", cursor:"pointer", outline:"none" },
  deleteBtn:          { width:"100%", padding:"0.6rem", background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:9, color:"#f87171", fontSize:"0.8rem", fontWeight:600, cursor:"pointer", marginTop:"0.25rem" },
  statusBar:          { padding:"0.55rem 1rem", borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:"0.5rem", flexShrink:0 },
  modalInput:         { height:38, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, padding:"0 0.875rem", color:"#e2e8f0", fontSize:"0.84rem", outline:"none", width:"100%" },
  dropZone:           { border:"1px dashed rgba(255,255,255,0.15)", borderRadius:9, padding:"1.25rem", textAlign:"center", cursor:"pointer", background:"rgba(255,255,255,0.02)" },
};