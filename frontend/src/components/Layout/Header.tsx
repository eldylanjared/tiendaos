import { useState, useEffect, useRef } from "react";
import type { User } from "@/types";

type View = "terminal" | "admin" | "price-checker" | "finance" | "personal-finance" | "tickets" | "chat";

interface Props {
  user: User;
  storeName: string;
  onLogout: () => void;
  view: View;
  onViewChange?: (view: View) => void;
  locked?: boolean;
}

// Inject responsive CSS once
let styleInjected = false;
function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .tos-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
      height: 48px;
      background: #ffffff;
      color: #000;
      flex-shrink: 0;
      border-bottom: 1px solid #e2e8f0;
      position: relative;
      z-index: 100;
    }
    .tos-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .tos-logo {
      font-weight: 700;
      font-size: 16px;
      color: #000;
      white-space: nowrap;
    }
    .tos-store {
      font-size: 13px;
      color: #64748b;
      white-space: nowrap;
    }
    .tos-nav-desktop {
      display: flex;
      gap: 4px;
      margin-left: 12px;
    }
    .tos-nav-btn, .tos-nav-link {
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: #000;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      font-family: inherit;
    }
    .tos-nav-btn:hover, .tos-nav-link:hover {
      background: #f8fafc;
    }
    .tos-nav-btn.active, .tos-nav-link.active {
      background: #f1f5f9;
      color: #000;
      border: 1px solid #e2e8f0;
      font-weight: 600;
    }
    .tos-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
    }
    .tos-user {
      font-size: 13px;
      color: #000;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tos-role {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      background: #e2e8f0;
      color: #000;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .tos-logout-btn {
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: transparent;
      color: #000;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
    }
    .tos-logout-btn:hover {
      background: #f8fafc;
    }
    .tos-hamburger {
      display: none;
      background: transparent;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      color: #000;
    }
    .tos-mobile-menu {
      display: none;
      position: absolute;
      top: 48px;
      left: 0;
      right: 0;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      padding: 8px;
      z-index: 99;
      flex-direction: column;
      gap: 2px;
    }
    .tos-mobile-menu.open {
      display: flex;
    }
    .tos-mobile-menu .tos-nav-btn,
    .tos-mobile-menu .tos-nav-link {
      padding: 10px 16px;
      font-size: 14px;
      text-align: left;
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
    }
    .tos-mobile-menu .tos-mobile-divider {
      height: 1px;
      background: #e2e8f0;
      margin: 4px 0;
    }
    .tos-mobile-menu .tos-mobile-user-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
    }

    @media (max-width: 860px) {
      .tos-nav-desktop { display: none; }
      .tos-hamburger { display: block; }
      .tos-store { display: none; }
      .tos-user { display: none; }
    }
    @media (min-width: 861px) {
      .tos-mobile-menu { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

export default function Header({ user, storeName, onLogout, view, onViewChange, locked }: Props) {
  const isAdminOrManager = user.role === "admin" || user.role === "manager";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { injectStyles(); }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  type NavItem = { label: string; viewKey: View; href: string; adminOnly: boolean };

  const navItems: NavItem[] = [
    { label: "Terminal", viewKey: "terminal", href: "/terminal", adminOnly: false },
    { label: "Precios", viewKey: "price-checker", href: "/precios", adminOnly: false },
    { label: "Admin", viewKey: "admin", href: "/admin", adminOnly: true },
    { label: "Finanzas", viewKey: "finance", href: "/finanzas", adminOnly: true },
    { label: "Mis Finanzas", viewKey: "personal-finance", href: "/mis-finanzas", adminOnly: false },
    { label: "Tickets", viewKey: "tickets", href: "/tickets", adminOnly: false },
    { label: "Chat", viewKey: "chat", href: "/chat", adminOnly: true },
  ];

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdminOrManager);

  function renderNavItem(item: NavItem) {
    const isActive = view === item.viewKey;
    const cls = locked ? "tos-nav-link" : "tos-nav-btn";
    const activeCls = isActive ? `${cls} active` : cls;

    if (locked) {
      return (
        <a key={item.viewKey} href={item.href} className={activeCls}>
          {item.label}
        </a>
      );
    }
    return (
      <button
        key={item.viewKey}
        className={activeCls}
        onClick={() => {
          onViewChange?.(item.viewKey);
          setMenuOpen(false);
        }}
      >
        {item.label}
      </button>
    );
  }

  return (
    <>
      <header className="tos-header">
        <div className="tos-header-left">
          <span className="tos-logo">TiendaOS</span>
          <span className="tos-store">{storeName}</span>
          <div className="tos-nav-desktop">
            {visibleItems.map(renderNavItem)}
          </div>
        </div>
        <div className="tos-header-right">
          <span className="tos-user">
            {user.full_name}
            <span className="tos-role">{user.role}</span>
          </span>
          <button className="tos-logout-btn" onClick={onLogout}>Salir</button>
          <button
            className="tos-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>
      <div ref={menuRef} className={`tos-mobile-menu${menuOpen ? " open" : ""}`}>
        {visibleItems.map(renderNavItem)}
        <div className="tos-mobile-divider" />
        <div className="tos-mobile-user-row">
          <span className="tos-user">
            {user.full_name}
            <span className="tos-role">{user.role}</span>
          </span>
          <button className="tos-logout-btn" onClick={onLogout}>Salir</button>
        </div>
      </div>
    </>
  );
}
