import type { User } from "@/types";

type View = "terminal" | "admin" | "price-checker";

interface Props {
  user: User;
  storeName: string;
  onLogout: () => void;
  view: View;
  onViewChange: (view: View) => void;
}

export default function Header({ user, storeName, onLogout, view, onViewChange }: Props) {
  const isAdminOrManager = user.role === "admin" || user.role === "manager";

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <span style={styles.logo}>TiendaOS</span>
        <span style={styles.store}>{storeName}</span>
        <div style={styles.nav}>
          <button
            style={view === "terminal" ? { ...styles.navBtn, ...styles.navBtnActive } : styles.navBtn}
            onClick={() => onViewChange("terminal")}
          >
            Terminal
          </button>
          <button
            style={view === "price-checker" ? { ...styles.navBtn, ...styles.navBtnActive } : styles.navBtn}
            onClick={() => onViewChange("price-checker")}
          >
            Precios
          </button>
          {isAdminOrManager && (
            <button
              style={view === "admin" ? { ...styles.navBtn, ...styles.navBtnActive } : styles.navBtn}
              onClick={() => onViewChange("admin")}
            >
              Admin
            </button>
          )}
        </div>
      </div>
      <div style={styles.right}>
        <span style={styles.user}>
          {user.full_name}
          <span style={styles.role}>{user.role}</span>
        </span>
        <button style={styles.logoutBtn} onClick={onLogout}>Salir</button>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 16px",
    height: 48,
    background: "#0f172a",
    color: "#fff",
    flexShrink: 0,
  },
  left: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontWeight: 700, fontSize: 16 },
  store: { fontSize: 13, color: "#94a3b8" },
  nav: { display: "flex", gap: 4, marginLeft: 12 },
  navBtn: {
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid transparent",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  navBtnActive: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
  },
  right: { display: "flex", alignItems: "center", gap: 12 },
  user: { fontSize: 13, display: "flex", alignItems: "center", gap: 6 },
  role: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    background: "#1e40af",
    padding: "2px 6px",
    borderRadius: 4,
  },
  logoutBtn: {
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid #334155",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
  },
};
