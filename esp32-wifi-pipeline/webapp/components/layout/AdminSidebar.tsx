// components/layout/AdminSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Buildings", href: "/admin/buildings" },
  { label: "Scan Sessions", href: "/admin/sessions" }, // will add later
  { label: "Raw Wi-Fi Scans", href: "/admin/raw-wifi-scans" },  
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">📶</span>
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-title">Wi-Fi Analytics</div>
          <div className="sidebar-logo-subtitle">Indoor Mapping System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${
                isActive ? "sidebar-nav-item-active" : ""
              }`}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <Link href="/user" className="sidebar-switch-button">
          <span>Switch to User Mode</span>
        </Link>
      </div>
    </aside>
  );
}