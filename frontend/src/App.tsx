import { useState, useEffect } from "react";
import Login from "@/components/Login";
import Header from "@/components/Layout/Header";
import Terminal from "@/components/POS/Terminal";
import { getStoredUser, clearAuth, isLoggedIn } from "@/store/auth";
import type { User } from "@/types";
import { Toaster } from "react-hot-toast";

const STORE_NAME = "Tienda Centro"; // Loaded from backend in Phase 2

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (isLoggedIn()) {
      setUser(getStoredUser());
    }
  }, []);

  function handleLogout() {
    clearAuth();
    setUser(null);
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
      <Header user={user} storeName={STORE_NAME} onLogout={handleLogout} />
      <Terminal storeName={STORE_NAME} />
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
