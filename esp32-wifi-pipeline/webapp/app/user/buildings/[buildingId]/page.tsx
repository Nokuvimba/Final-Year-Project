// app/user/buildings/[buildingId]/page.tsx
"use client";

import { fetchRooms, fetchBuildings, fetchBuildingScans } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState, use } from "react";

type Props = {
  params: Promise<{ buildingId: string }>;
};

export default function UserBuildingPage({ params }: Props) {
  const resolvedParams = use(params);
  const buildingId = Number(resolvedParams.buildingId);
  
  const [buildings, setBuildings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [scansData, setScansData] = useState<any>({ rows: [] });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadData() {
      try {
        const [buildingsData, roomsData, scansDataResult] = await Promise.all([
          fetchBuildings(),
          fetchRooms(buildingId),
          fetchBuildingScans(buildingId, 50),
        ]);
        setBuildings(buildingsData);
        setRooms(roomsData);
        setScansData(scansDataResult);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    
    // Auto-refresh every 5 seconds to update room colors
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [buildingId]);
  
  if (loading) return <div className="page">Loading...</div>;


  const building = buildings.find(b => b.id === buildingId);
  
  if (!building) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Building not found</h2>
          <Link href="/user" className="button button-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link href="/user" className="link-back">← Back to Dashboard</Link>
          <h1 className="page-title">{building.name}</h1>
          {building.description && (
            <p className="page-subtitle">{building.description}</p>
          )}
        </div>
      </header>

      <section className="metrics-row">
        <div className="metric-card metric-card-blue">
          <div className="metric-card-title">Total Rooms</div>
          <div className="metric-card-value">{rooms.length}</div>
        </div>

        <div className="metric-card metric-card-green">
          <div className="metric-card-title">Recent Scans</div>
          <div className="metric-card-value">{scansData.rows.length}</div>
        </div>

        <div className="metric-card metric-card-purple">
          <div className="metric-card-title">Unique SSIDs</div>
          <div className="metric-card-value">
            {new Set(scansData.rows.map(r => r.ssid).filter(Boolean)).size}
          </div>
        </div>
      </section>

      <section className="heatmap-container">
        <h3 className="heatmap-title">Building Floor Plan - Wi-Fi Signal Heatmap</h3>
        <div className="floor-plan">
          <svg viewBox="0 0 800 600" className="floor-svg">
            {/* Background */}
            <rect width="800" height="600" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2"/>
            
            {/* Gradient definitions for heatmap */}
            <defs>
              <radialGradient id="strongSignal" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.2"/>
              </radialGradient>
              <radialGradient id="mediumSignal" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2"/>
              </radialGradient>
              <radialGradient id="weakSignal" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2"/>
              </radialGradient>
              <radialGradient id="noSignal" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.1"/>
              </radialGradient>
            </defs>
            
            {/* Room outlines */}
            {rooms.map((room, index) => {
              const x = (index % 4) * 180 + 50;
              const y = Math.floor(index / 4) * 140 + 50;
              
              // Get actual scans for this room
              const roomScans = scansData.rows.filter(scan => scan.room_name === room.name);
              
              // Determine room color based on scan distribution
              let gradientId = 'noSignal'; // Default for no scans
              
              if (roomScans.length > 0) {
                const strongScans = roomScans.filter(scan => scan.rssi >= -50).length;
                const mediumScans = roomScans.filter(scan => scan.rssi >= -70 && scan.rssi < -50).length;
                const weakScans = roomScans.filter(scan => scan.rssi < -70).length;
                
                if (weakScans === roomScans.length || (strongScans + mediumScans === 1)) {
                  gradientId = 'weakSignal'; // Red: only weak scans OR only one medium/strong scan
                } else if (strongScans > mediumScans) {
                  gradientId = 'strongSignal'; // Green: more strong than medium
                } else if (mediumScans > strongScans) {
                  gradientId = 'mediumSignal'; // Yellow: more medium than strong
                } else {
                  gradientId = 'weakSignal'; // Red: equal or other cases
                }
              }
              
              return (
                <g key={room.id}>
                  {/* Room rectangle */}
                  <rect 
                    x={x} 
                    y={y} 
                    width="150" 
                    height="100" 
                    fill="white" 
                    stroke="#94a3b8" 
                    strokeWidth="2"
                    rx="8"
                  />
                  
                  {/* Signal strength overlay - only show if there are scans */}
                  {roomScans.length > 0 && (
                    <circle 
                      cx={x + 75} 
                      cy={y + 50} 
                      r="60" 
                      fill={`url(#${gradientId})`}
                    />
                  )}
                  
                  {/* Access point indicator */}
                  <circle 
                    cx={x + 75} 
                    cy={y + 50} 
                    r="4" 
                    fill="#1e40af"
                  />
                  
                  {/* Room label */}
                  <text 
                    x={x + 75} 
                    y={y + 25} 
                    textAnchor="middle" 
                    fontSize="12" 
                    fontWeight="600" 
                    fill="#1f2937"
                  >
                    {room.name}
                  </text>
                  
                  {/* Signal strength text */}
                  <text 
                    x={x + 75} 
                    y={y + 85} 
                    textAnchor="middle" 
                    fontSize="10" 
                    fill="#6b7280"
                  >
                    {roomScans.length > 0 ? `${roomScans.length} scans` : 'No scans'}
                  </text>
                  
                  {/* Clickable overlay */}
                  <rect 
                    x={x} 
                    y={y} 
                    width="150" 
                    height="100" 
                    fill="transparent" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.open(`/user/buildings/${buildingId}/rooms/${room.id}`, '_self')}
                  />
                </g>
              );
            })}
          </svg>
        </div>
        
        <div className="heatmap-legend">
          <h4>Signal Strength</h4>
          <div className="legend-content">
            <div className="legend-gradient">
              <div className="gradient-bar"></div>
              <div className="gradient-labels">
                <span>Weak</span>
                <span>Medium</span>
                <span>Strong</span>
              </div>
            </div>
            <span className="legend-guide">Strong (green) = -50 dBm or better • Medium (yellow) = -50 to -70 dBm • Weak (red) = below -70 dBm</span>
          </div>
        </div>
      </section>
    </div>
  );
}