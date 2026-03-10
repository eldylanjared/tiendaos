import { useState, useEffect } from "react";
import Login from "@/components/Login";
import Header from "@/components/Layout/Header";
import Terminal from "@/components/POS/Terminal";
import PriceChecker from "@/components/PriceChecker/PriceChecker";
import AdminPanel from "@/components/Admin/AdminPanel";
import FinanceTracker from "@/components/Finance/FinanceTracker";
import ChatPanel from "@/components/Chat/ChatPanel";
import { getStoredUser, clearAuth, isLoggedIn } from "@/store/auth";
import { setAuthExpiredHandler } from "@/services/api";
import { useKeepAlive } from "@/hooks/useKeepAlive";
import type { User } from "@/types";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";

const STORE_NAME = "Tienda Centro"; // Loaded from backend in Phase 2

type View = "terminal" | "admin" | "price-checker" | "finance" | "personal-finance" | "chat";

// Path-based routing: /precios, /terminal, /admin
// "locked" means the URL path locks to that view (no nav switching)
function getViewFromPath(): { view: View; locked: boolean } {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, "");

  if (path === "/precios") return { view: "price-checker", locked: true };
  if (path === "/admin") return { view: "admin", locked: true };
  if (path === "/terminal") return { view: "terminal", locked: true };
  if (path === "/finanzas") return { view: "finance", locked: true };
  if (path === "/mis-finanzas") return { view: "personal-finance", locked: true };
  if (path === "/chat") return { view: "chat", locked: true };

  // Legacy query param support
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "price-checker") return { view: "price-checker", locked: true };

  // Root path — full access, default to terminal
  return { view: "terminal", locked: false };
}

const INITIAL_ROUTE = getViewFromPath();

function isKioskMode(): boolean {
  return INITIAL_ROUTE.view === "price-checker" && INITIAL_ROUTE.locked;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>(INITIAL_ROUTE.view);

  const isKiosk = isKioskMode();

  // Keep screen awake + auto-refresh token + warn before close (if cart might have items)
  useKeepAlive({ warnBeforeClose: view === "terminal" });

  useEffect(() => {
    if (isLoggedIn()) {
      setUser(getStoredUser());
    }

    // Handle expired auth — show login screen with a message
    setAuthExpiredHandler(() => {
      clearAuth();
      setUser(null);
      toast.error("Sesion expirada. Ingresa de nuevo.", { duration: 5000 });
    });
  }, []);

  function handleLogout() {
    clearAuth();
    setUser(null);
    setView("terminal");
  }

  // Kiosk mode: price checker without login
  if (isKiosk) {
    return (
      <>
        <PriceChecker storeName={STORE_NAME} />
        <Toaster position="top-center" />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Login onLogin={setUser} />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <div style={styles.app}>
      <Header
        user={user}
        storeName={STORE_NAME}
        onLogout={handleLogout}
        view={view}
        onViewChange={INITIAL_ROUTE.locked ? undefined : setView}
        locked={INITIAL_ROUTE.locked}
      />
      {view === "terminal" && <Terminal storeName={STORE_NAME} />}
      {view === "admin" && <AdminPanel />}
      {view === "price-checker" && <PriceChecker storeName={STORE_NAME} />}
      {view === "finance" && <div style={{ flex: 1, overflow: "auto" }}><FinanceTracker user={user} /></div>}
      {view === "personal-finance" && <div style={{ flex: 1, overflow: "auto" }}><FinanceTracker user={user} personal /></div>}
      {view === "chat" && <div style={{ flex: 1, overflow: "hidden" }}><ChatPanel /></div>}
      <Toaster position="top-right" />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
};
