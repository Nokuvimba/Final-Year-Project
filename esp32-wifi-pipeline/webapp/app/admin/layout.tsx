// app/admin/layout.tsx
import "../globals.css";
import type { ReactNode } from "react";
import { AdminSidebar } from "../../components/layout/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}