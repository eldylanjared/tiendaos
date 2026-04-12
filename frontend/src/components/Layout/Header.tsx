import { useState, useEffect, useRef } from "react";
import type { User } from "@/types";
import type { OfflineSyncState } from "@/hooks/useOfflineSync";

type View = "terminal" | "admin" | "price-checker" | "finance" | "personal-finance" | "tickets" | "chat";

interface Props {
  user: User;
  storeName: string;
  onLogout: () => void;
  view: View;
  onViewChange?: (view: View) => void;
  locked?: boolean;
  offlineSync?: OfflineSyncState;
}

function OfflineBadge({ state }: { state: OfflineSyncState }) {
  if (state.isOnline && !state.isSyncing && state.pendingCount === 0) return null;

  if (!state.isOnline) {
    return (
      <span style={{
        background: "#ef4444", color: "#fff", fontSize: 11,
        fontWeight: 600, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap",
      }}>
        Sin conexión{state.pendingCount > 0 ? ` · ${state.pendingCount} pend.` : ""}
      </span>
    );
  }
  if (state.isSyncing) {
    return (
      <span style={{
        background: "#22c55e", color: "#fff", fontSize: 11,
        fontWeight: 600, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap",
      }}>
        Sincronizando...
      </span>
    );
  }
  return (
    <span style={{
      background: "#f59e0b", color: "#fff", fontSize: 11,
      fontWeight: 600, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap",
    }}>
      {state.pendingCount} pendientes
    </span>
  );
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

interface SyncStatus {
  pull_products: { last_synced_at: string | null; last_result: string };
  push_sales: { last_synced_at: string | null; last_result: string };
  pending_sales: number;
}

function SyncBadge({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const load = () => {
      const token = localStorage.getItem("token");
      fetch("/api/sync/status", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setStatus(d))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [isAdmin]);

  if (!isAdmin || !status) return null;

  const hasError =
    status.pull_products.last_result.startsWith("error") ||
    status.push_sales.last_result.startsWith("error");
  const hasPending = status.pending_sales > 0;
  const skipped = status.pull_products.last_result === "" && status.push_sales.last_result === "";

  const color = hasError ? "#ef4444" : hasPending ? "#f59e0b" : skipped ? "#94a3b8" : "#22c55e";
  const tooltip = skipped
    ? "Sync no configurado"
    : hasError
    ? "Error en sync"
    : hasPending
    ? `${status.pending_sales} ventas pendientes`
    : "Sincronizado";

  async function triggerSync() {
    setSyncing(true);
    const token = localStorage.getItem("token");
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      await fetch("/api/sync/now", { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" }, body: "{}" });
      const r = await fetch("/api/sync/status", { headers: authHeader });
      if (r.ok) setStatus(await r.json());
    } catch {}
    setSyncing(false);
  }

  return (
    <button
      title={tooltip}
      onClick={triggerSync}
      disabled={syncing}
      style={{
        background: "transparent",
        border: "none",
        cursor: syncing ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 6px",
        borderRadius: "6px",
        fontSize: "11px",
        color: "#64748b",
      }}
    >
      <span style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        animation: syncing ? "pulse 1s infinite" : undefined,
      }} />
      {hasPending ? status.pending_sales : ""}
    </button>
  );
}

export default function Header({ user, storeName, onLogout, view, onViewChange, locked, offlineSync }: Props) {
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
          {offlineSync && <OfflineBadge state={offlineSync} />}
          <SyncBadge isAdmin={isAdminOrManager} />
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
