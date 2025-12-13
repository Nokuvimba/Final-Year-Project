// app/user/layout.tsx
import "../globals.css";
import type { ReactNode } from "react";
import { UserSidebar } from "../../components/layout/UserSidebar";

export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <UserSidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}