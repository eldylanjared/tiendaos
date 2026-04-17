import { useState, useEffect } from "react";

interface VersionInfo {
  commit: string;
  message: string;
  date: string;
  branch: string;
}

async function fetchVersion(): Promise<VersionInfo> {
  const token = localStorage.getItem("token");
  const r = await fetch("/api/admin/system/version", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("No autorizado");
  return r.json();
}

async function triggerUpdate(): Promise<{ log: string; version: VersionInfo }> {
  const token = localStorage.getItem("token");
  const r = await fetch("/api/admin/system/update", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json();
}

export default function SistemaPanel() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [updating, setUpdating] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVersion().then(setVersion).catch((e) => setError(e.message));
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    setLog(null);
    setError(null);
    try {
      const res = await triggerUpdate();
      setLog(res.log);
      setVersion(res.version);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Sistema</h2>

      {/* Version card */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Version actual</div>
        {version ? (
          <div style={styles.versionGrid}>
            <span style={styles.label}>Commit</span>
            <code style={styles.mono}>{version.commit}</code>
            <span style={styles.label}>Rama</span>
            <code style={styles.mono}>{version.branch}</code>
            <span style={styles.label}>Mensaje</span>
            <span>{version.message}</span>
            <span style={styles.label}>Fecha</span>
            <span style={styles.muted}>{version.date}</span>
          </div>
        ) : error ? (
          <p style={styles.errorText}>{error}</p>
        ) : (
          <p style={styles.muted}>Cargando...</p>
        )}
      </div>

      {/* Update button */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Actualizar sistema</div>
        <p style={styles.muted}>
          Descarga el codigo mas reciente de GitHub, reconstruye el frontend y reinicia el servidor.
          El sistema estara fuera de linea unos segundos al final.
        </p>
        <button
          style={updating ? { ...styles.btn, ...styles.btnDisabled } : styles.btn}
          onClick={handleUpdate}
          disabled={updating}
        >
          {updating ? "Actualizando..." : "Actualizar ahora"}
        </button>

        {log && (
          <pre style={styles.logBox}>{log}</pre>
        )}
        {error && !updating && (
          <p style={styles.errorText}>{error}</p>
        )}
      </div>

      {/* Offline / hybrid info */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Modo offline e instalacion local</div>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <div style={styles.infoHeader}>Como funciona offline</div>
            <ul style={styles.list}>
              <li>El backend corre en tu computadora en <code>localhost:8000</code></li>
              <li>Las ventas se guardan en SQLite local aunque no haya internet</li>
              <li>Cuando regresa la conexion, se sincronizan automaticamente con la nube</li>
              <li>Los productos se actualizan desde el servidor central</li>
            </ul>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoHeader}>Instalar en una computadora de tienda</div>
            <p style={styles.muted}>Descarga el instalador para Linux (Ubuntu/Debian):</p>
            <a
              href="/install.sh"
              download="tiendaos-install.sh"
              style={styles.downloadBtn}
            >
              Descargar install.sh
            </a>
            <p style={{ ...styles.muted, marginTop: 12 }}>
              Luego ejecuta en la terminal:
            </p>
            <pre style={styles.codeBlock}>bash tiendaos-install.sh</pre>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoHeader}>Configuracion necesaria (.env)</div>
            <pre style={styles.codeBlock}>{`IS_LOCAL_INSTANCE=true
STORE_ID=tienda-1
STORE_NAME=Sucursal Centro
CLOUD_API_URL=https://dylanlopez.com/api
CLOUD_SYNC_USER=admin
CLOUD_SYNC_PASSWORD=tu_password`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 860, margin: "0 auto" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#0f172a" },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#1e293b" },
  versionGrid: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: "6px 12px",
    alignItems: "center",
    fontSize: 14,
  },
  label: { color: "#64748b", fontWeight: 500 },
  mono: { fontFamily: "monospace", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: 13 },
  muted: { color: "#64748b", fontSize: 13, margin: "4px 0" },
  btn: {
    padding: "10px 20px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    marginTop: 8,
  },
  btnDisabled: { background: "#94a3b8", cursor: "not-allowed" },
  logBox: {
    marginTop: 16,
    background: "#0f172a",
    color: "#e2e8f0",
    padding: 14,
    borderRadius: 8,
    fontSize: 12,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    maxHeight: 400,
    overflowY: "auto",
  },
  errorText: { color: "#dc2626", fontSize: 13, marginTop: 8 },
  infoGrid: { display: "flex", flexDirection: "column", gap: 16 },
  infoItem: {},
  infoHeader: { fontWeight: 600, fontSize: 14, marginBottom: 6, color: "#1e293b" },
  list: { fontSize: 13, color: "#475569", paddingLeft: 20, margin: 0, lineHeight: 1.8 },
  downloadBtn: {
    display: "inline-block",
    marginTop: 8,
    padding: "8px 16px",
    background: "#059669",
    color: "#fff",
    borderRadius: 7,
    fontWeight: 600,
    fontSize: 13,
    textDecoration: "none",
  },
  codeBlock: {
    background: "#f1f5f9",
    padding: "10px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "monospace",
    margin: "6px 0 0",
    whiteSpace: "pre-wrap",
  },
};
