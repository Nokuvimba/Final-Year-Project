// app/admin/layout.tsx
import "../globals.css"; // path is correct if globals.css is in app/
import type { ReactNode } from "react";
import { AdminSidebar } from "../../components/layout/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <AdminSidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}