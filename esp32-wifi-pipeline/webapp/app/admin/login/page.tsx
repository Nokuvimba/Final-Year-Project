"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Production: POST /auth/login → JWT in httpOnly cookie → Next.js middleware guard later on 
const DEMO_EMAIL    = "admin@mssia.ie";
const DEMO_PASSWORD = "admin123";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  function clearError() { if (error) setError(""); }

  async function handleSubmit() {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError("");

    // Simulating network delay for realism
    await new Promise(r => setTimeout(r, 500));

    if (email.trim() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      router.push("/admin/studio");
    } else {
      setError("Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <main className="login-root">
      {/* Background layers */}
      <div className="grid-bg"  aria-hidden="true" />
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />

      {/* Card */}
      <div className="card">

        {/* Logo */}
        <div className="logo-row">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="3" fill="white" />
              <circle cx="10" cy="10" r="6.5" stroke="white" strokeWidth="1.3" strokeDasharray="2 2" />
              <circle cx="10" cy="10" r="9.5" stroke="white" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 3" />
            </svg>
          </div>
          <span className="logo-text">MSSIA</span>
        </div>

        {/* Heading */}
        <div className="heading-block">
          <h1 className="heading">Welcome back</h1>
          <p className="subheading">Sign in to Map Studio</p>
        </div>

        {/* Form */}
        <div className="form">

          {/* Email */}
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={`input ${error ? "input-error" : ""}`}
              placeholder="admin@mssia.ie"
              value={email}
              autoComplete="email"
              onChange={e => { setEmail(e.target.value); clearError(); }}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <div className="input-wrap">
              <input
                id="password"
                type={showPass ? "text" : "password"}
                className={`input ${error ? "input-error" : ""}`}
                placeholder="••••••••"
                value={password}
                autoComplete="current-password"
                onChange={e => { setPassword(e.target.value); clearError(); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                disabled={loading}
                style={{ paddingRight: "2.5rem" }}
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                    <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                    <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="error-msg" role="alert">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="#f87171" strokeWidth="1.3"/>
                <path d="M7 4v3M7 9.5v.5" stroke="#f87171" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            className="submit-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </div>

        {/* Footer link */}
        <div className="card-footer">
          <Link href="/" className="back-link">
            ← Back to home
          </Link>
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background: #060d1a;
          display: flex; align-items: center; justify-content: center;
          font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
          position: relative; overflow: hidden;
          padding: 1.5rem;
        }

        /* Background */
        .grid-bg {
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none; z-index: 0;
        }
        .orb {
          position: fixed; border-radius: 50%;
          filter: blur(90px); pointer-events: none; z-index: 0;
          animation: drift 14s ease-in-out infinite alternate;
        }
        .orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(29,78,216,0.18) 0%, transparent 70%);
          top: -160px; left: -120px;
        }
        .orb-2 {
          width: 380px; height: 380px;
          background: radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%);
          bottom: -80px; right: -80px; animation-delay: -7s;
        }
        @keyframes drift {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(24px,16px) scale(1.06); }
        }

        /* Card */
        .card {
          position: relative; z-index: 10;
          width: 100%; max-width: 420px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          padding: 2.5rem 2rem;
          display: flex; flex-direction: column; gap: 1.75rem;
          animation: fadeUp 0.7s ease 0.05s both;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
        }
        @keyframes fadeUp {
          from { opacity:0; transform: translateY(24px); }
          to   { opacity:1; transform: translateY(0); }
        }

        /* Logo */
        .logo-row {
          display: flex; align-items: center; gap: 0.6rem;
          justify-content: center;
        }
        .logo-icon {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, #1d4ed8, #3b82f6);
          border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px rgba(59,130,246,0.4);
        }
        .logo-text {
          font-size: 1rem; font-weight: 800;
          letter-spacing: 0.14em; color: #f1f5f9;
        }

        /* Headings */
        .heading-block { text-align: center; display: flex; flex-direction: column; gap: 0.3rem; }
        .heading {
          font-size: 1.5rem; font-weight: 800;
          color: #f8fafc; letter-spacing: -0.02em;
        }
        .subheading { font-size: 0.85rem; color: #64748b; }

        /* Form */
        .form { display: flex; flex-direction: column; gap: 1rem; }

        .field { display: flex; flex-direction: column; gap: 0.4rem; }
        .label {
          font-size: 0.78rem; font-weight: 600;
          color: #94a3b8; letter-spacing: 0.04em; text-transform: uppercase;
        }

        .input-wrap { position: relative; }
        .input {
          width: 100%; height: 42px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 0 0.875rem;
          color: #e2e8f0; font-size: 0.88rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input::placeholder { color: #334155; }
        .input:focus {
          border-color: #1d4ed8;
          box-shadow: 0 0 0 3px rgba(29,78,216,0.2);
        }
        .input:disabled { opacity: 0.5; cursor: not-allowed; }
        .input-error { border-color: rgba(248,113,113,0.5) !important; }
        .input-error:focus { box-shadow: 0 0 0 3px rgba(248,113,113,0.15) !important; }

        .eye-btn {
          position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: #475569; cursor: pointer;
          padding: 0; display: flex; align-items: center; justify-content: center;
          transition: color 0.15s;
        }
        .eye-btn:hover { color: #94a3b8; }

        /* Error */
        .error-msg {
          display: flex; align-items: center; gap: 0.4rem;
          font-size: 0.8rem; color: #f87171;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: 8px; padding: 0.5rem 0.75rem;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-4px); }
          40%,80%  { transform: translateX(4px); }
        }

        /* Submit */
        .submit-btn {
          width: 100%; height: 44px; margin-top: 0.25rem;
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          border: none; border-radius: 10px;
          color: #fff; font-size: 0.92rem; font-weight: 700;
          font-family: inherit; letter-spacing: 0.02em;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          box-shadow: 0 0 24px rgba(37,99,235,0.4), 0 4px 12px rgba(0,0,0,0.3);
          transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          box-shadow: 0 0 36px rgba(59,130,246,0.5), 0 6px 16px rgba(0,0,0,0.35);
          transform: translateY(-1px);
        }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* Spinner */
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Footer */
        .card-footer { text-align: center; }
        .back-link {
          font-size: 0.8rem; color: #475569;
          text-decoration: none;
          transition: color 0.15s;
        }
        .back-link:hover { color: #94a3b8; }
      `}</style>
    </main>
  );
}