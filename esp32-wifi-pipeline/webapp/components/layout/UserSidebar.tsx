// components/layout/UserSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Buildings", href: "/user", icon: "🏢" },
];

export function UserSidebar() {
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
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${
                isActive ? "sidebar-nav-item-active" : ""
              }`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <Link href="/admin" className="sidebar-switch-button">
          <span className="sidebar-nav-icon">👤</span>
          <span>Switch to Admin Mode</span>
        </Link>
      </div>
    </aside>
  );
}