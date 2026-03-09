import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="landing">
      {/* Grid + orbs */}
      <div className="grid-bg" aria-hidden="true" />
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />

      {/* Nav */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="2.5" fill="white" />
              <circle cx="9" cy="9" r="5.5" stroke="white" strokeWidth="1.2" strokeDasharray="2 2" />
              <circle cx="9" cy="9" r="8.5" stroke="white" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 3" />
            </svg>
          </div>
          <span className="nav-logo-text">MSSIA</span>
        </div>
        <div className="nav-pill">Final Year Project · 2026</div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="eyebrow-dot" />
          Spatial Intelligence Platform
        </div>

        <h1 className="hero-title">
          <span className="title-line">Multi-Sensor</span>
          <span className="title-line title-accent">Spatial Intelligence</span>
          <span className="title-line title-sub">& Analytics Platform</span>
        </h1>

        <p className="hero-subtitle">
          Distributed ESP32 nodes collect WiFi, temperature, humidity and air
          quality data across indoor spaces — visualised as interactive
          floor&nbsp;plan heatmaps in real&nbsp;time.
        </p>

        <div className="hero-actions">
          <Link href="/user" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2C4.68 2 2 4.68 2 8s2.68 6 6 6 6-2.68 6-6-2.68-6-6-6zm0 2a4 4 0 110 8A4 4 0 018 4zm0 1.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" fill="currentColor" />
            </svg>
            View Signal Map
          </Link>
          <Link href="/admin/login" className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Admin Login
          </Link>
        </div>
      </section>

      {/* 4 Sensor cards */}
      <section className="sensors">
        <SensorCard
          color="#3b82f6"
          icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="2.5" fill="#3b82f6" />
              <circle cx="11" cy="11" r="5.5" stroke="#3b82f6" strokeWidth="1.3" strokeDasharray="2 2" />
              <circle cx="11" cy="11" r="9" stroke="#3b82f6" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3" />
            </svg>
          }
          label="WiFi Signal"
          unit="dBm"
          range="−30 → −90"
          desc="RSSI heatmap across all scan points. Identifies dead zones and strong coverage areas on the floor plan."
        />
        <SensorCard
          color="#f97316"
          icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 3v8.5" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="11" cy="15" r="3" stroke="#f97316" strokeWidth="1.4" />
              <path d="M7 7h1M7 10h1M7 4h1" stroke="#f97316" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          }
          label="Temperature"
          unit="°C"
          range="0 → 50 °C"
          desc="DHT22 sensor readings mapped spatially. Reveals hot spots, cold zones and HVAC distribution across rooms."
        />
        <SensorCard
          color="#06b6d4"
          icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 4C11 4 7 10 7 13.5a4 4 0 008 0C15 10 11 4 11 4z" stroke="#06b6d4" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M9 14a2 2 0 002 2" stroke="#06b6d4" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          }
          label="Humidity"
          unit="%RH"
          range="0 → 100 %"
          desc="Relative humidity from DHT22 co-located with temperature. Highlights damp areas and ventilation issues."
        />
        <SensorCard
          color="#10b981"
          icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 15c2-4 4-6 6-5s3 4 5 4 3-2 3-5" stroke="#10b981" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="11" cy="7" r="2" stroke="#10b981" strokeWidth="1.3" />
            </svg>
          }
          label="Air Quality"
          unit="ppm"
          range="CO₂ / VOC"
          desc="MQ135 air quality index per scan point. Pinpoints poor ventilation, elevated CO₂ and volatile compounds."
        />
      </section>

      {/* Footer */}
      <footer className="footer">
        <span>Nokuvimba Natalie Chiyaka · Final Year Project · 2026</span>
      </footer>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .landing {
          min-height: 100vh;
          background: #060d1a;
          color: #e2e8f0;
          font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
          display: flex; flex-direction: column; align-items: center;
          position: relative; overflow: hidden;
          padding: 0 1.5rem;
        }

        .grid-bg {
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none; z-index: 0;
        }

        .orb { position: fixed; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; animation: drift 14s ease-in-out infinite alternate; }
        .orb-1 { width:480px; height:480px; background: radial-gradient(circle, rgba(29,78,216,0.16) 0%, transparent 70%); top:-120px; left:-100px; }
        .orb-2 { width:380px; height:380px; background: radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%); bottom:60px; right:-80px; animation-delay:-6s; }
        .orb-3 { width:300px; height:300px; background: radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%); top:55%; left:50%; transform:translate(-50%,-50%); animation-name:drift3; animation-delay:-10s; }
        @keyframes drift { from{transform:translate(0,0)scale(1)} to{transform:translate(28px,18px)scale(1.07)} }
        @keyframes drift3 { from{transform:translate(-50%,-50%)scale(1)} to{transform:translate(calc(-50% + 18px),calc(-50% - 26px))scale(1.05)} }

        .nav {
          position: relative; z-index: 10;
          width: 100%; max-width: 980px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.5rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          animation: fadeDown 0.6s ease both;
        }
        .nav-logo { display:flex; align-items:center; gap:0.65rem; }
        .nav-logo-icon { width:36px; height:36px; background:linear-gradient(135deg,#1d4ed8,#3b82f6); border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 22px rgba(59,130,246,0.35); }
        .nav-logo-text { font-size:0.9rem; font-weight:700; letter-spacing:0.14em; color:#f1f5f9; }
        .nav-pill { font-size:0.7rem; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; color:#64748b; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:100px; padding:0.3rem 0.75rem; }

        .hero {
          position: relative; z-index: 10;
          width: 100%; max-width: 980px;
          padding: 5.5rem 0 3.5rem;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          animation: fadeUp 0.8s ease 0.1s both;
        }
        .hero-eyebrow { display:flex; align-items:center; gap:0.5rem; font-size:0.72rem; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#3b82f6; margin-bottom:1.5rem; }
        .eyebrow-dot { width:6px; height:6px; border-radius:50%; background:#3b82f6; animation:pulse 2s ease infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.5)} }

        .hero-title { display:flex; flex-direction:column; gap:0.05em; font-size:clamp(2.4rem,6vw,4.4rem); font-weight:800; line-height:1.1; letter-spacing:-0.03em; color:#f8fafc; margin-bottom:1.4rem; }
        .title-accent { background:linear-gradient(135deg,#3b82f6 20%,#60a5fa 60%,#93c5fd 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .title-sub { font-size:clamp(1.2rem,3vw,2rem); font-weight:500; color:#64748b; letter-spacing:-0.01em; -webkit-text-fill-color:#64748b; }

        .hero-subtitle { font-size:1rem; line-height:1.8; color:#94a3b8; max-width:520px; margin-bottom:2.5rem; }

        .hero-actions { display:flex; gap:0.875rem; flex-wrap:wrap; justify-content:center; }
        .btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.78rem 1.65rem; border-radius:10px; font-size:0.9rem; font-weight:600; text-decoration:none; transition:all 0.2s ease; letter-spacing:0.01em; border:1px solid transparent; }
        .btn-primary { background:linear-gradient(135deg,#1d4ed8,#2563eb); color:#fff; box-shadow:0 0 28px rgba(37,99,235,0.4),0 4px 14px rgba(0,0,0,0.3); }
        .btn-primary:hover { background:linear-gradient(135deg,#2563eb,#3b82f6); box-shadow:0 0 40px rgba(59,130,246,0.5),0 6px 18px rgba(0,0,0,0.35); transform:translateY(-2px); }
        .btn-secondary { background:rgba(255,255,255,0.04); color:#cbd5e1; border-color:rgba(255,255,255,0.1); }
        .btn-secondary:hover { background:rgba(255,255,255,0.08); border-color:rgba(59,130,246,0.4); color:#e2e8f0; transform:translateY(-2px); }

        /* Sensor cards */
        .sensors {
          position: relative; z-index: 10;
          width: 100%; max-width: 980px;
          display: grid; grid-template-columns: repeat(4,1fr);
          gap: 1rem; margin-bottom: 5rem;
          animation: fadeUp 0.8s ease 0.28s both;
        }
        .sensor-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 1.4rem 1.2rem;
          display: flex; flex-direction: column; gap: 0.85rem;
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
          position: relative; overflow: hidden;
        }
        .sensor-card::before {
          content:''; position:absolute; top:0; left:0; right:0; height:2px;
          background: var(--cc); opacity:0.7; border-radius:14px 14px 0 0;
        }
        .sensor-card:hover { background:rgba(255,255,255,0.045); transform:translateY(-4px); }
        .sensor-icon { width:44px; height:44px; background:rgba(255,255,255,0.05); border-radius:11px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.08); }
        .sensor-label { font-size:0.88rem; font-weight:700; color:#f1f5f9; }
        .sensor-meta { display:flex; align-items:center; gap:0.4rem; margin-top:0.2rem; }
        .sensor-unit { font-size:0.67rem; font-weight:600; font-family:'DM Mono','Fira Code',monospace; color:var(--cc); background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:4px; padding:0.15rem 0.4rem; }
        .sensor-range { font-size:0.64rem; color:#475569; font-family:'DM Mono','Fira Code',monospace; }
        .sensor-desc { font-size:0.76rem; line-height:1.65; color:#64748b; }

        .footer { position:relative; z-index:10; padding:1.5rem 0; border-top:1px solid rgba(255,255,255,0.06); width:100%; max-width:980px; text-align:center; font-size:0.7rem; color:#334155; letter-spacing:0.04em; text-transform:uppercase; }

        @keyframes fadeUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }

        @media(max-width:768px){ .sensors{grid-template-columns:repeat(2,1fr)} }
        @media(max-width:480px){ .sensors{grid-template-columns:1fr} .hero{padding:4rem 0 2.5rem} }
      `}</style>
    </main>
  );
}

function SensorCard({ color, icon, label, unit, range, desc }: {
  color: string; icon: React.ReactNode;
  label: string; unit: string; range: string; desc: string;
}) {
  return (
    <div className="sensor-card" style={{ "--cc": color } as React.CSSProperties}>
      <div className="sensor-icon">{icon}</div>
      <div>
        <div className="sensor-label">{label}</div>
        <div className="sensor-meta">
          <span className="sensor-unit">{unit}</span>
          <span className="sensor-range">{range}</span>
        </div>
      </div>
      <p className="sensor-desc">{desc}</p>
    </div>
  );
}