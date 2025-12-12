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
          <Link href="/admin" className="button button-primary">
            Admin Dashboard
          </Link>
          <Link href="/user" className="button button-secondary">
            User Interface
          </Link>
        </div>
      </div>
    </main>
  );
}