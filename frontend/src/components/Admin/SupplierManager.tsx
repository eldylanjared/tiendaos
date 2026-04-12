import { useState, useEffect, useRef } from "react";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, uploadSupplierImage, getSupplierProducts } from "@/services/api";
import type { Supplier } from "@/types";
import toast from "react-hot-toast";

type SupplierProduct = { id: string; name: string; barcode: string; price: number; stock: number; is_active: boolean };

const EMPTY: Partial<Supplier> = {
  name: "", rfc: "", address: "", phone: "", extra_phone: "",
  contact_name: "", extra_contact_name: "", avg_weekly_purchase: 0, notes: "",
};

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>(EMPTY);
  const [imagePreview, setImagePreview] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [productsMap, setProductsMap] = useState<Record<string, SupplierProduct[]>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    try { setSuppliers(await getSuppliers()); } catch { /* ignore */ }
  }

  function openCreate() {
    setSelected(null);
    setForm(EMPTY);
    setImagePreview("");
    setImageFile(null);
    setShowForm(true);
  }

  function openEdit(s: Supplier) {
    setSelected(s);
    setForm({ ...s });
    setImagePreview(s.picture_url);
    setImageFile(null);
    setShowForm(true);
  }

  function setField(k: keyof Supplier, v: unknown) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.name?.trim()) { toast.error("Nombre requerido"); return; }
    setSaving(true);
    try {
      let saved: Supplier;
      if (selected) {
        saved = await updateSupplier(selected.id, form);
      } else {
        saved = await createSupplier(form);
      }
      if (imageFile) {
        const res = await uploadSupplierImage(saved.id, imageFile);
        saved.picture_url = res.picture_url;
      }
      toast.success(selected ? "Proveedor actualizado" : "Proveedor creado");
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Supplier) {
    if (!window.confirm(`¿Eliminar a ${s.name}? Se desvinculará de sus productos.`)) return;
    try {
      await deleteSupplier(s.id);
      toast.success("Proveedor eliminado");
      load();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  }

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.rfc.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  );

  if (showForm) {
    return (
      <div style={S.formWrap}>
        <div style={S.formHeader}>
          <h2 style={S.formTitle}>{selected ? "Editar Proveedor" : "Nuevo Proveedor"}</h2>
          <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
        </div>

        <div style={S.formGrid}>
          {/* Picture */}
          <div style={S.picSection}>
            <div style={S.picWrap} onClick={() => fileRef.current?.click()}>
              {imagePreview ? (
                <img src={imagePreview} style={S.picImg} alt="proveedor" />
              ) : (
                <div style={S.picPlaceholder}>
                  <span style={{ fontSize: 32 }}>📷</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Subir foto</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
          </div>

          {/* Main fields */}
          <div style={S.fields}>
            <div style={S.row2}>
              <label style={S.label}>
                Nombre *
                <input style={S.input} value={form.name || ""} onChange={(e) => setField("name", e.target.value)} />
              </label>
              <label style={S.label}>
                RFC
                <input style={S.input} value={form.rfc || ""} onChange={(e) => setField("rfc", e.target.value)} placeholder="XAXX010101000" />
              </label>
            </div>

            <label style={S.label}>
              Dirección
              <input style={S.input} value={form.address || ""} onChange={(e) => setField("address", e.target.value)} />
            </label>

            <div style={S.row2}>
              <label style={S.label}>
                Teléfono
                <input style={S.input} value={form.phone || ""} onChange={(e) => setField("phone", e.target.value)} />
              </label>
              <label style={S.label}>
                Teléfono extra
                <input style={S.input} value={form.extra_phone || ""} onChange={(e) => setField("extra_phone", e.target.value)} />
              </label>
            </div>

            <div style={S.row2}>
              <label style={S.label}>
                Contacto principal
                <input style={S.input} value={form.contact_name || ""} onChange={(e) => setField("contact_name", e.target.value)} />
              </label>
              <label style={S.label}>
                Contacto secundario
                <input style={S.input} value={form.extra_contact_name || ""} onChange={(e) => setField("extra_contact_name", e.target.value)} />
              </label>
            </div>

            <label style={S.label}>
              Compra promedio semanal ($)
              <input
                style={S.input}
                type="number"
                value={form.avg_weekly_purchase || 0}
                onChange={(e) => setField("avg_weekly_purchase", parseFloat(e.target.value) || 0)}
              />
            </label>

            <label style={S.label}>
              Notas
              <textarea
                style={{ ...S.input, height: 80, resize: "vertical" }}
                value={form.notes || ""}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </label>
          </div>
        </div>

        <div style={S.formActions}>
          <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
          <button style={S.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={S.toolbar}>
        <input
          style={S.search}
          placeholder="Buscar proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button style={S.addBtn} onClick={openCreate}>+ Nuevo</button>
      </div>

      <div style={S.count}>{filtered.length} proveedores</div>

      <div style={S.grid}>
        {filtered.map((s) => (
          <div key={s.id} style={S.card}>
            <div style={S.cardTop}>
              <div style={S.avatar}>
                {s.picture_url ? (
                  <img src={s.picture_url} style={S.avatarImg} alt={s.name} />
                ) : (
                  <div style={S.avatarInitial}>{s.name.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div style={S.cardInfo}>
                <div style={S.cardName}>{s.name}</div>
                {s.rfc && <div style={S.cardRfc}>{s.rfc}</div>}
              </div>
            </div>

            <div style={S.cardDetails}>
              {s.phone && <div style={S.detail}>📞 {s.phone}</div>}
              {s.extra_phone && <div style={S.detail}>📞 {s.extra_phone}</div>}
              {s.contact_name && <div style={S.detail}>👤 {s.contact_name}</div>}
              {s.extra_contact_name && <div style={S.detail}>👤 {s.extra_contact_name}</div>}
              {s.address && <div style={S.detail}>📍 {s.address}</div>}
            </div>

            <div style={S.cardStats}>
              <button
                style={S.statBtn}
                onClick={async () => {
                  if (expandedId === s.id) { setExpandedId(null); return; }
                  setExpandedId(s.id);
                  if (!productsMap[s.id]) {
                    try {
                      const prods = await getSupplierProducts(s.id);
                      setProductsMap((p) => ({ ...p, [s.id]: prods }));
                    } catch { setProductsMap((p) => ({ ...p, [s.id]: [] })); }
                  }
                }}
              >
                <span style={S.statLabel}>Productos</span>
                <span style={S.statValue}>{s.product_count} {expandedId === s.id ? "▲" : "▼"}</span>
              </button>
              <div style={S.stat}>
                <span style={S.statLabel}>Compra/semana</span>
                <span style={S.statValue}>${s.avg_weekly_purchase.toLocaleString("es-MX")}</span>
              </div>
            </div>

            {expandedId === s.id && (
              <div style={S.productList}>
                {!productsMap[s.id] ? (
                  <div style={S.productRow}>Cargando...</div>
                ) : productsMap[s.id].length === 0 ? (
                  <div style={S.productRow}>Sin productos asignados</div>
                ) : (
                  productsMap[s.id].map((p) => (
                    <div key={p.id} style={S.productRow}>
                      <div style={S.productName}>
                        {!p.is_active && <span style={S.inactiveBadge}>inactivo</span>}
                        {p.name}
                      </div>
                      <div style={S.productMeta}>
                        <span style={S.productBarcode}>{p.barcode}</span>
                        <span style={S.productPrice}>${p.price.toFixed(2)}</span>
                        <span style={{ ...S.productStock, color: p.stock <= 0 ? "#dc2626" : "#16a34a" }}>
                          {p.stock} uds
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div style={S.cardActions}>
              <button style={S.editBtn} onClick={() => openEdit(s)}>Editar</button>
              <button style={S.deleteBtn} onClick={() => handleDelete(s)}>Eliminar</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={S.empty}>No se encontraron proveedores</p>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  toolbar: { display: "flex", gap: 8, marginBottom: 12 },
  search: { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none" },
  addBtn: { padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  count: { fontSize: 13, color: "#64748b", marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  card: { background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  cardTop: { display: "flex", gap: 12, alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", flexShrink: 0 },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  avatarInitial: { width: "100%", height: "100%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff" },
  cardInfo: { minWidth: 0 },
  cardName: { fontSize: 15, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardRfc: { fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 },
  cardDetails: { display: "flex", flexDirection: "column", gap: 4 },
  detail: { fontSize: 12, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardStats: { display: "flex", gap: 8 },
  stat: { flex: 1, background: "#f8fafc", borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 },
  statBtn: { flex: 1, background: "#f8fafc", borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2, border: "none", cursor: "pointer", textAlign: "left" as const },
  productList: { background: "#f8fafc", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" },
  productRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, gap: 8 },
  productName: { flex: 1, color: "#1e293b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, display: "flex", alignItems: "center", gap: 6 },
  productMeta: { display: "flex", gap: 8, alignItems: "center", flexShrink: 0 },
  productBarcode: { color: "#94a3b8", fontFamily: "monospace", fontSize: 11 },
  productPrice: { color: "#0f172a", fontWeight: 600 },
  productStock: { fontSize: 11, fontWeight: 600 },
  inactiveBadge: { fontSize: 9, fontWeight: 700, background: "#fca5a5", color: "#7f1d1d", padding: "1px 5px", borderRadius: 4, textTransform: "uppercase" as const },
  statLabel: { fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" },
  statValue: { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  cardActions: { display: "flex", gap: 6 },
  editBtn: { flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#334155", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  deleteBtn: { padding: "6px 12px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  empty: { color: "#94a3b8", textAlign: "center", padding: 40, gridColumn: "1/-1" },
  // Form
  formWrap: { maxWidth: 780, margin: "0 auto" },
  formHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 },
  formGrid: { display: "flex", gap: 24, marginBottom: 20 },
  picSection: { flexShrink: 0 },
  picWrap: { width: 140, height: 140, borderRadius: 12, border: "2px dashed #e2e8f0", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  picImg: { width: "100%", height: "100%", objectFit: "cover" },
  picPlaceholder: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  fields: { flex: 1, display: "flex", flexDirection: "column", gap: 12 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500, color: "#374151" },
  input: { padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const },
  formActions: { display: "flex", justifyContent: "flex-end", gap: 8 },
  cancelBtn: { padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  saveBtn: { padding: "8px 20px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 },
};
