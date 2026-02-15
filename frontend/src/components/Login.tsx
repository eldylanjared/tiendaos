import { useState } from "react";
import { loginWithPin, loginWithPassword } from "@/services/api";
import { saveAuth } from "@/store/auth";
import type { User } from "@/types";

interface Props {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: Props) {
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePin() {
    if (pin.length !== 4) return;
    setLoading(true);
    setError("");
    try {
      const res = await loginWithPin(pin);
      saveAuth(res.access_token, res.user);
      onLogin(res.user);
    } catch (e: any) {
      setError(e.message || "PIN inválido");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await loginWithPassword(username, password);
      saveAuth(res.access_token, res.user);
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  }

  function handlePinKey(digit: string) {
    if (digit === "clear") {
      setPin("");
      return;
    }
    if (digit === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        setPin(next);
        // trigger login
        (async () => {
          setLoading(true);
          setError("");
          try {
            const res = await loginWithPin(next);
            saveAuth(res.access_token, res.user);
            onLogin(res.user);
          } catch (err: any) {
            setError(err.message || "PIN inválido");
            setPin("");
          } finally {
            setLoading(false);
          }
        })();
      }, 100);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>TiendaOS</h1>
        <p style={styles.subtitle}>Punto de Venta</p>

        {error && <div style={styles.error}>{error}</div>}

        {!showPassword ? (
          <>
            <p style={styles.label}>Ingresa tu PIN</p>
            <div style={styles.pinDisplay}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ ...styles.pinDot, ...(pin.length > i ? styles.pinDotFilled : {}) }} />
              ))}
            </div>
            <div style={styles.numpad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
                <button
                  key={key}
                  style={{
                    ...styles.numKey,
                    ...(key === "clear" || key === "back" ? styles.numKeyAction : {}),
                  }}
                  onClick={() => handlePinKey(key)}
                  disabled={loading}
                >
                  {key === "clear" ? "C" : key === "back" ? "←" : key}
                </button>
              ))}
            </div>
            <button style={styles.switchBtn} onClick={() => setShowPassword(true)}>
              Usar contraseña
            </button>
          </>
        ) : (
          <form onSubmit={handlePassword} style={styles.form}>
            <input
              style={styles.input}
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button style={styles.loginBtn} type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button style={styles.switchBtn} type="button" onClick={() => setShowPassword(false)}>
              Usar PIN
            </button>
          </form>
        )}
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
  label: { margin: "0 0 16px", color: "#334155", fontSize: 14 },
  error: {
    background: "#fef2f2",
    color: "#dc2626",
    padding: "8px 12px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
  },
  pinDisplay: { display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: "2px solid #cbd5e1",
    transition: "all 0.15s",
  },
  pinDotFilled: { background: "#2563eb", borderColor: "#2563eb" },
  numpad: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    maxWidth: 240,
    margin: "0 auto 16px",
  },
  numKey: {
    padding: "14px 0",
    fontSize: 20,
    fontWeight: 600,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    background: "#f8fafc",
    cursor: "pointer",
    transition: "all 0.1s",
  },
  numKeyAction: { fontSize: 16, color: "#64748b" },
  switchBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 13,
    marginTop: 8,
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
