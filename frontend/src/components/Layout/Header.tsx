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
    background: "#ffffff",
    color: "#000",
    flexShrink: 0,
    borderBottom: "1px solid #e2e8f0",
  },
  left: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontWeight: 700, fontSize: 16, color: "#000" },
  store: { fontSize: 13, color: "#64748b" },
  nav: { display: "flex", gap: 4, marginLeft: 12 },
  navBtn: {
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid transparent",
    background: "transparent",
    color: "#000",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  navBtnActive: {
    background: "#f1f5f9",
    color: "#000",
    border: "1px solid #e2e8f0",
    fontWeight: 600,
  },
  right: { display: "flex", alignItems: "center", gap: 12 },
  user: { fontSize: 13, color: "#000", display: "flex", alignItems: "center", gap: 6 },
  role: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    background: "#e2e8f0",
    color: "#000",
    padding: "2px 6px",
    borderRadius: 4,
  },
  logoutBtn: {
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "transparent",
    color: "#000",
    cursor: "pointer",
    fontSize: 12,
  },
};
