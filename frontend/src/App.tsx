import { useState, useEffect } from "react";
import Login from "@/components/Login";
import Header from "@/components/Layout/Header";
import Terminal from "@/components/POS/Terminal";
import PriceChecker from "@/components/PriceChecker/PriceChecker";
import AdminPanel from "@/components/Admin/AdminPanel";
import { getStoredUser, clearAuth, isLoggedIn } from "@/store/auth";
import type { User } from "@/types";
import { Toaster } from "react-hot-toast";

const STORE_NAME = "Tienda Centro"; // Loaded from backend in Phase 2

type View = "terminal" | "admin" | "price-checker";

function getInitialView(): View {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "price-checker") return "price-checker";
  return "terminal";
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>(getInitialView);

  const isKiosk = view === "price-checker" && new URLSearchParams(window.location.search).get("mode") === "price-checker";

  useEffect(() => {
    if (isLoggedIn()) {
      setUser(getStoredUser());
    }
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
        onViewChange={setView}
      />
      {view === "terminal" && <Terminal storeName={STORE_NAME} />}
      {view === "admin" && <AdminPanel />}
      {view === "price-checker" && <PriceChecker storeName={STORE_NAME} />}
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
