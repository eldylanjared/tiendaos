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
        <div style={styles.cardTitle}>Como funciona el modo offline</div>
        <ul style={styles.list}>
          <li>El backend corre en la computadora de la tienda en <code>localhost:8000</code></li>
          <li>Las ventas se guardan en SQLite local aunque no haya internet</li>
          <li>Cuando regresa la conexion, se sincronizan automaticamente con la nube</li>
          <li>Los productos y precios se actualizan desde el servidor central</li>
        </ul>
      </div>

      {/* Installers */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Instalar en computadora de tienda</div>
        <div style={styles.osGrid}>

          <div style={styles.osCard}>
            <div style={styles.osTitle}>Windows</div>
            <ol style={styles.stepList}>
              <li>Descarga el instalador</li>
              <li>Abre PowerShell como <strong>Administrador</strong></li>
              <li>Ejecuta en dos lineas:<br /><code style={styles.inlineCode}>Set-ExecutionPolicy Bypass -Scope Process -Force</code><br /><code style={styles.inlineCode}>.\tiendaos-install.ps1</code></li>
              <li>Edita el archivo <code>.env</code> que se abre automaticamente</li>
              <li>El sistema arranca y se registra para iniciar con Windows</li>
            </ol>
            <a href="/install_windows.ps1" download="tiendaos-install.ps1" style={styles.downloadBtn}>
              Descargar tiendaos-install.ps1
            </a>
          </div>

          <div style={styles.osCard}>
            <div style={styles.osTitle}>Mac</div>
            <ol style={styles.stepList}>
              <li>Descarga el instalador</li>
              <li>Abre Terminal</li>
              <li>Ejecuta:<br /><code style={styles.inlineCode}>bash ~/Downloads/tiendaos-install-mac.sh</code></li>
              <li>Edita <code>~/tiendaos/backend/.env</code> con los datos de la tienda</li>
              <li>El sistema arranca automaticamente al iniciar sesion</li>
            </ol>
            <a href="/install_mac.sh" download="tiendaos-install-mac.sh" style={styles.downloadBtn}>
              Descargar tiendaos-install-mac.sh
            </a>
          </div>

          <div style={styles.osCard}>
            <div style={styles.osTitle}>Linux (Ubuntu/Debian)</div>
            <ol style={styles.stepList}>
              <li>Abre Terminal</li>
              <li>Ejecuta:<br /><code style={styles.inlineCode}>curl -fsSL https://dylanlopez.com/install.sh | bash</code></li>
              <li>Edita <code>/opt/tiendaos/backend/.env</code></li>
              <li>El sistema corre como servicio systemd</li>
            </ol>
            <a href="/install.sh" download="tiendaos-install.sh" style={styles.downloadBtn}>
              Descargar tiendaos-install.sh
            </a>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={styles.cardTitle}>Configuracion requerida (.env)</div>
          <p style={styles.muted}>Despues de instalar, edita el archivo <code>.env</code> en la carpeta del backend. Cada variable se explica abajo:</p>

          <table style={styles.envTable}>
            <thead>
              <tr>
                <th style={styles.envTh}>Variable</th>
                <th style={styles.envTh}>Ejemplo</th>
                <th style={styles.envTh}>Que es</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["IS_LOCAL_INSTANCE", "true", "Activa el modo local + sincronizacion con la nube. Siempre true en tiendas."],
                ["STORE_ID", "tienda-centro", "ID unico para esta tienda. Sin espacios. Ej: tienda-1, tienda-norte."],
                ["STORE_NAME", "Sucursal Centro", "Nombre que aparece en recibos y reportes."],
                ["CLOUD_API_URL", "https://dylanlopez.com/api", "URL del servidor central. No cambiar."],
                ["CLOUD_SYNC_USER", "admin", "Usuario del servidor central para sincronizar. Usa 'admin' o crea uno especifico."],
                ["CLOUD_SYNC_PASSWORD", "••••••••", "Contrasena del usuario en el servidor central. Ver instrucciones abajo."],
              ].map(([key, val, desc]) => (
                <tr key={key}>
                  <td style={styles.envKey}>{key}</td>
                  <td style={styles.envVal}>{val}</td>
                  <td style={styles.envDesc}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ ...styles.infoItem, marginTop: 16 }}>
            <div style={styles.infoHeader}>Como obtener el CLOUD_SYNC_PASSWORD</div>
            <p style={styles.muted}>La contrasena es la del usuario <strong>admin</strong> en el servidor central (dylanlopez.com). Para verla o cambiarla:</p>
            <ol style={styles.stepList}>
              <li>Entra a <strong>dylanlopez.com</strong> → Admin → Empleados</li>
              <li>Busca el usuario <strong>admin</strong> y cambia su contrasena</li>
              <li>Usa esa misma contrasena como <code>CLOUD_SYNC_PASSWORD</code> en el .env de la tienda</li>
              <li>Reinicia el servicio: <code>systemctl restart tiendaos</code> (Linux) o ejecuta el script de nuevo (Mac/Windows)</li>
            </ol>
            <p style={{ ...styles.muted, marginTop: 8 }}>
              Tambien puedes crear un usuario dedicado para sincronizacion con rol <strong>admin</strong> y usar sus credenciales.
              Esto es mas seguro que usar la cuenta admin principal.
            </p>
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
  list: { fontSize: 13, color: "#475569", paddingLeft: 20, margin: "6px 0 0", lineHeight: 1.8 },
  downloadBtn: {
    display: "inline-block",
    marginTop: 12,
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
  osGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  osCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 16,
  },
  osTitle: { fontWeight: 700, fontSize: 15, marginBottom: 10, color: "#1e293b" },
  stepList: { fontSize: 13, color: "#475569", paddingLeft: 18, margin: 0, lineHeight: 2 },
  envTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
    marginTop: 8,
  },
  envTh: {
    textAlign: "left" as const,
    padding: "6px 10px",
    background: "#f1f5f9",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: 600,
    color: "#475569",
  },
  envKey: {
    padding: "7px 10px",
    fontFamily: "monospace",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 600,
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap" as const,
  },
  envVal: {
    padding: "7px 10px",
    fontFamily: "monospace",
    fontSize: 12,
    color: "#2563eb",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap" as const,
  },
  envDesc: {
    padding: "7px 10px",
    color: "#64748b",
    borderBottom: "1px solid #f1f5f9",
    lineHeight: 1.5,
  },
  inlineCode: {
    fontFamily: "monospace",
    fontSize: 11,
    background: "#f1f5f9",
    padding: "2px 4px",
    borderRadius: 3,
    display: "inline-block",
    marginTop: 4,
    wordBreak: "break-all",
  },
};
