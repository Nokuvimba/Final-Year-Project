// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-landing">
      <div className="home-card">
        <h1 className="page-title">Wi-Fi Analytics Dashboard</h1>
        <p className="page-subtitle">
          Choose how you want to explore the campus Wi-Fi data.
        </p>

        <div className="home-actions">
          <Link href="/admin/buildings" className="button button-primary">
            Go to Admin Mode
          </Link>
          <Link href="/user" className="button button-secondary">
            Go to User Mode
          </Link>
        </div>
      </div>
    </main>
  );
}