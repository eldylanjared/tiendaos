import { useState } from "react";
import { loginWithPassword } from "@/services/api";
import { saveAuth } from "@/store/auth";
import type { User } from "@/types";

interface Props {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await loginWithPassword(username, password);
      saveAuth(res.access_token, res.user);
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || "Credenciales invalidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>TiendaOS</h1>
        <p style={styles.subtitle}>Punto de Venta</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Contrasena"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button style={styles.loginBtn} type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "40px 32px",
    width: 340,
    textAlign: "center",
    boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
  },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: "#0f172a" },
  subtitle: { margin: "4px 0 24px", color: "#64748b", fontSize: 14 },
  error: {
    background: "#fef2f2",
    color: "#dc2626",
    padding: "8px 12px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: {
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 15,
    outline: "none",
  },
  loginBtn: {
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
};
