import { useState, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

const API = "/api/products";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", color: PRESET_COLORS[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/categories`, { headers: authHeaders() });
      if (r.ok) setCategories(await r.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditing(null);
    setForm({ name: "", color: PRESET_COLORS[0] });
    setError("");
  }

  function startEdit(cat: Category) {
    setEditing(cat);
    setForm({ name: cat.name, color: cat.color });
    setError("");
  }

  function cancelForm() {
    setEditing(null);
    setForm({ name: "", color: PRESET_COLORS[0] });
    setError("");
  }

  async function save() {
    if (!form.name.trim()) { setError("El nombre es requerido"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editing ? `${API}/categories/${editing.id}` : `${API}/categories`;
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({ name: form.name.trim(), color: form.color }),
      });
      if (!r.ok) { setError("Error al guardar"); return; }
      await load();
      cancelForm();
    } finally {
      setSaving(false);
    }
  }

  async function remove(cat: Category) {
    if (!confirm(`¿Eliminar categoría "${cat.name}"? Los productos quedarán sin categoría.`)) return;
    const r = await fetch(`${API}/categories/${cat.id}`, { method: "DELETE", headers: authHeaders() });
    if (r.ok) load();
  }

  const showForm = editing !== null || (editing === null && form.name !== "" || false);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Categorías</h2>
        <button onClick={startCreate} style={btnStyle("#2563eb")}>+ Nueva categoría</button>
      </div>

      {/* Form */}
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
          {editing ? `Editar: ${editing.name}` : "Nueva categoría"}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={labelStyle}>Nombre</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && save()}
              placeholder="Ej. Bebidas, Snacks..."
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", background: c, border: "none",
                    cursor: "pointer",
                    outline: form.color === c ? "2px solid #0f172a" : "2px solid transparent",
                    outlineOffset: 2,
                  }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 28, height: 28, padding: 0, border: "1px solid #e2e8f0", borderRadius: "50%", cursor: "pointer" }}
                title="Color personalizado"
              />
            </div>
          </div>
        </div>
        {error && <div style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={save} disabled={saving} style={btnStyle("#2563eb")}>
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear categoría"}
          </button>
          {editing && <button onClick={cancelForm} style={btnStyle("#64748b")}>Cancelar</button>}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Cargando...</div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No hay categorías aún.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.map(cat => (
            <div key={cat.id} style={{
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
              padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                background: cat.color, flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{cat.name}</span>
              <button onClick={() => startEdit(cat)} style={iconBtn}>Editar</button>
              <button onClick={() => remove(cat)} style={{ ...iconBtn, color: "#ef4444" }}>Eliminar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg, color: "#fff", border: "none", borderRadius: 6,
  padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500,
});
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0",
  borderRadius: 6, fontSize: 14, boxSizing: "border-box",
};
const iconBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid #e2e8f0", borderRadius: 6,
  padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#475569",
};
