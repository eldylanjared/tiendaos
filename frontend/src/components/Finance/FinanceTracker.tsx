import { useState, useEffect, useRef } from "react";
import {
  getFinanceEntries, getFinanceSummary, getFinanceCategories,
  createFinanceEntry, deleteFinanceEntry, getFinanceImageUrl,
  scanReceipt, getFinanceEmployees,
} from "@/services/api";
import type { FinanceEntry, FinanceSummary, FinanceCategories, FinanceEmployee, User } from "@/types";
import toast from "react-hot-toast";

const CATEGORY_LABELS: Record<string, string> = {
  proveedores: "Proveedores",
  renta: "Renta",
  servicios: "Servicios (luz, agua, tel)",
  nomina: "Nomina",
  transporte: "Transporte",
  mantenimiento: "Mantenimiento",
  impuestos: "Impuestos",
  publicidad: "Publicidad",
  varios: "Varios",
  ventas_efectivo: "Ventas Efectivo",
  ventas_tarjeta: "Ventas Tarjeta",
  otros_ingresos: "Otros Ingresos",
  prestamo: "Prestamo",
  devolucion: "Devolucion",
};

type Tab = "list" | "add";

interface Props {
  user: User;
}

export default function FinanceTracker({ user }: Props) {
  const isAdminOrManager = user.role === "admin" || user.role === "manager";

  const [tab, setTab] = useState<Tab>("list");
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [categories, setCategories] = useState<FinanceCategories | null>(null);
  const [employees, setEmployees] = useState<FinanceEmployee[]>([]);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // Add form state
  const [entryType, setEntryType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    getFinanceCategories().then(setCategories).catch(() => {});
    if (isAdminOrManager) {
      getFinanceEmployees().then(setEmployees).catch(() => {});
    }
  }, []);

  useEffect(() => { loadData(); }, [start, end, filter, filterEmployee]);

  async function loadData() {
    try {
      const userId = filterEmployee || undefined;
      const [e, s] = await Promise.all([
        getFinanceEntries(start || undefined, end || undefined, filter === "all" ? undefined : filter, userId),
        getFinanceSummary(start || undefined, end || undefined, userId),
      ]);
      setEntries(e);
      setSummary(s);
    } catch { /* ignore */ }
  }

  const [scanning, setScanning] = useState(false);
  const [rawText, setRawText] = useState("");
  const [confidence, setConfidence] = useState("");

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Auto-scan the receipt
    setScanning(true);
    try {
      const result = await scanReceipt(file);
      if (result.amount > 0) setAmount(String(result.amount));
      if (result.category) setCategory(result.category);
      if (result.description) setDescription(result.description);
      if (result.date) {
        const ocrDate = new Date(result.date);
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        const tomorrow = new Date();
        tomorrow.setDate(now.getDate() + 1);
        if (ocrDate >= oneYearAgo && ocrDate < tomorrow) {
          setEntryDate(result.date);
        }
      }
      if (result.entry_type) setEntryType(result.entry_type as "income" | "expense");
      setRawText(result.raw_text || "");
      setConfidence(result.confidence || "");
      toast.success(
        result.confidence === "high" ? "Recibo procesado" :
        result.confidence === "medium" ? "Datos parciales extraidos — revisa los campos" :
        "No se pudo leer bien — llena los campos manualmente"
      );
    } catch (err: any) {
      toast.error("No se pudo procesar: " + err.message);
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit() {
    if (!category) { toast.error("Selecciona una categoria"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Ingresa un monto valido"); return; }

    setSaving(true);
    try {
      await createFinanceEntry({
        entry_type: entryType,
        category,
        amount: Number(amount),
        description,
        date: entryDate,
        assigned_to: assignedTo || undefined,
        image: image || undefined,
      });
      toast.success(entryType === "income" ? "Ingreso registrado" : "Gasto registrado");
      if (image && description) {
        try {
          const form = new FormData();
          form.append("vendor", description);
          form.append("category", category);
          form.append("entry_type", entryType);
          await fetch("/api/finance/learn-vendor", {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            body: form,
          });
        } catch { /* non-critical */ }
      }
      if (entryDate < start) setStart(entryDate);
      if (entryDate > end) setEnd(entryDate);
      setCategory("");
      setAmount("");
      setDescription("");
      setAssignedTo("");
      setImage(null);
      setImagePreview(null);
      setRawText("");
      setConfidence("");
      setEntryDate("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTab("list");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFinanceEntry(id);
      toast.success("Registro eliminado");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const catOptions = categories
    ? (entryType === "expense" ? categories.expense : categories.income)
    : [];

  return (
    <div style={s.container}>
      {/* Image preview modal */}
      {previewImg && (
        <div style={s.overlay} onClick={() => setPreviewImg(null)}>
          <img src={previewImg} style={s.previewImage} alt="Recibo" />
        </div>
      )}

      {/* Title */}
      <h2 style={s.pageTitle}>{isAdminOrManager ? "Finanzas" : "Mis Gastos"}</h2>

      {/* Tab bar */}
      <div style={s.tabBar}>
        <button style={tab === "list" ? { ...s.tabBtn, ...s.tabBtnActive } : s.tabBtn} onClick={() => setTab("list")}>
          Movimientos
        </button>
        <button style={tab === "add" ? { ...s.tabBtn, ...s.tabBtnActive } : s.tabBtn} onClick={() => setTab("add")}>
          + Nuevo
        </button>
      </div>

      {tab === "list" && (
        <>
          {/* Summary cards */}
          {summary && (
            <div style={s.summaryRow}>
              <div style={{ ...s.summaryCard, borderTopColor: "#16a34a" }}>
                <span style={s.summaryLabel}>Ingresos</span>
                <span style={{ ...s.summaryValue, color: "#16a34a" }}>
                  ${summary.total_income.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ ...s.summaryCard, borderTopColor: "#dc2626" }}>
                <span style={s.summaryLabel}>Gastos</span>
                <span style={{ ...s.summaryValue, color: "#dc2626" }}>
                  ${summary.total_expenses.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ ...s.summaryCard, borderTopColor: summary.balance >= 0 ? "#2563eb" : "#dc2626" }}>
                <span style={s.summaryLabel}>Balance</span>
                <span style={{ ...s.summaryValue, color: summary.balance >= 0 ? "#2563eb" : "#dc2626" }}>
                  ${summary.balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {summary && (summary.expense_categories.length > 0 || summary.income_categories.length > 0) && (
            <div style={s.breakdownRow}>
              {summary.expense_categories.length > 0 && (
                <div style={s.breakdownCard}>
                  <span style={s.breakdownTitle}>Gastos por Categoria</span>
                  {summary.expense_categories.map((c) => (
                    <div key={c.category} style={s.breakdownItem}>
                      <span style={s.breakdownCat}>{CATEGORY_LABELS[c.category] || c.category}</span>
                      <span style={s.breakdownAmt}>${c.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              {summary.income_categories.length > 0 && (
                <div style={s.breakdownCard}>
                  <span style={s.breakdownTitle}>Ingresos por Categoria</span>
                  {summary.income_categories.map((c) => (
                    <div key={c.category} style={s.breakdownItem}>
                      <span style={s.breakdownCat}>{CATEGORY_LABELS[c.category] || c.category}</span>
                      <span style={s.breakdownAmt}>${c.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div style={s.filters}>
            <input type="date" style={s.dateInput} value={start} onChange={(e) => setStart(e.target.value)} />
            <span style={{ color: "#94a3b8", fontSize: 12 }}>a</span>
            <input type="date" style={s.dateInput} value={end} onChange={(e) => setEnd(e.target.value)} />
            <select style={s.select} value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">Todos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
            </select>
            {isAdminOrManager && employees.length > 0 && (
              <select
                style={s.select}
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
              >
                <option value="">Todos los empleados</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Entry list */}
          <div style={s.list}>
            {entries.map((entry) => (
              <div key={entry.id} style={s.entryRow}>
                <div style={s.entryLeft}>
                  <div style={s.entryTop}>
                    <span style={{
                      ...s.typeBadge,
                      background: entry.entry_type === "income" ? "#dcfce7" : "#fef2f2",
                      color: entry.entry_type === "income" ? "#16a34a" : "#dc2626",
                    }}>
                      {entry.entry_type === "income" ? "INGRESO" : "GASTO"}
                    </span>
                    <span style={s.entryCat}>{CATEGORY_LABELS[entry.category] || entry.category}</span>
                  </div>
                  {entry.description && <span style={s.entryDesc}>{entry.description}</span>}
                  <div style={s.entryMeta}>
                    <span style={s.entryDate}>{entry.date}</span>
                    {entry.assigned_name && (
                      <span style={s.assignedBadge}>{entry.assigned_name}</span>
                    )}
                    {!entry.assigned_name && isAdminOrManager && entry.user_name && (
                      <span style={s.creatorLabel}>por {entry.user_name}</span>
                    )}
                  </div>
                </div>
                <div style={s.entryRight}>
                  <span style={{
                    ...s.entryAmount,
                    color: entry.entry_type === "income" ? "#16a34a" : "#dc2626",
                  }}>
                    {entry.entry_type === "income" ? "+" : "-"}${entry.amount.toFixed(2)}
                  </span>
                  <div style={s.entryActions}>
                    {entry.image_path && (
                      <button
                        style={s.imgBtn}
                        onClick={() => setPreviewImg(getFinanceImageUrl(entry.image_path))}
                      >Foto</button>
                    )}
                    {isAdminOrManager && (
                      <button style={s.deleteBtn} onClick={() => handleDelete(entry.id)}>X</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {entries.length === 0 && <p style={s.empty}>Sin movimientos para este periodo</p>}
          </div>
        </>
      )}

      {tab === "add" && (
        <div style={s.form}>
          {/* Type toggle */}
          <div style={s.typeToggle}>
            <button
              style={entryType === "expense" ? { ...s.typeBtn, ...s.typeBtnExpense } : s.typeBtn}
              onClick={() => { setEntryType("expense"); setCategory(""); }}
            >Gasto</button>
            <button
              style={entryType === "income" ? { ...s.typeBtn, ...s.typeBtnIncome } : s.typeBtn}
              onClick={() => { setEntryType("income"); setCategory(""); }}
            >Ingreso</button>
          </div>

          {/* Amount — big input */}
          <div style={s.amountWrapper}>
            <span style={s.amountSign}>$</span>
            <input
              style={s.amountInput}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>

          {/* Category */}
          <label style={s.label}>Categoria</label>
          <div style={s.catGrid}>
            {catOptions.map((cat) => (
              <button
                key={cat}
                style={category === cat ? { ...s.catBtn, ...s.catBtnActive } : s.catBtn}
                onClick={() => setCategory(cat)}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          {/* Assign to employee */}
          {isAdminOrManager && employees.length > 0 && (
            <>
              <label style={s.label}>Asignar a empleado (opcional)</label>
              <select
                style={s.input}
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Sin asignar (gasto de tienda)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>
                ))}
              </select>
            </>
          )}

          {/* Description */}
          <label style={s.label}>Descripcion (opcional)</label>
          <input
            style={s.input}
            placeholder="Ej: Compra de refrescos proveedor X"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Date */}
          <label style={s.label}>Fecha</label>
          <input
            type="date"
            style={s.input}
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />

          {/* Photo upload */}
          <label style={s.label}>Foto del recibo (escanea para llenar automatico)</label>
          <div style={s.uploadArea}>
            {imagePreview ? (
              <div style={s.previewWrap}>
                <img src={imagePreview} style={s.thumbnail} alt="Preview" />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {scanning && <span style={s.scanningText}>Procesando imagen...</span>}
                  {!scanning && confidence && (
                    <span style={{
                      ...s.confidenceBadge,
                      background: confidence === "high" ? "#dcfce7" : confidence === "medium" ? "#fef9c3" : "#fef2f2",
                      color: confidence === "high" ? "#16a34a" : confidence === "medium" ? "#a16207" : "#dc2626",
                    }}>
                      {confidence === "high" ? "Datos extraidos" : confidence === "medium" ? "Datos parciales" : "Revisa manualmente"}
                    </span>
                  )}
                  <button style={s.removeImg} onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                    setRawText("");
                    setConfidence("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}>Quitar</button>
                </div>
              </div>
            ) : (
              <button style={s.uploadBtn} onClick={() => fileInputRef.current?.click()}>
                Tomar Foto / Elegir Imagen
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handleImageSelect}
            />
          </div>
          {rawText && (
            <details style={s.rawTextDetails}>
              <summary style={s.rawTextSummary}>Ver texto extraido</summary>
              <pre style={s.rawTextPre}>{rawText}</pre>
            </details>
          )}

          {/* Submit */}
          <button
            style={s.submitBtn}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Guardando..." : entryType === "income" ? "Registrar Ingreso" : "Registrar Gasto"}
          </button>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 600,
    margin: "0 auto",
    padding: "0 8px",
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#0f172a",
    margin: "16px 0 8px",
  },
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000,
  },
  previewImage: { maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 },
  tabBar: {
    display: "flex", gap: 0, marginBottom: 12,
    borderBottom: "1px solid #e2e8f0", background: "#fff",
  },
  tabBtn: {
    flex: 1, padding: "12px 0", border: "none",
    borderBottom: "2px solid transparent", background: "transparent",
    color: "#64748b", cursor: "pointer", fontSize: 15, fontWeight: 500,
    textAlign: "center",
  },
  tabBtnActive: { color: "#0f172a", borderBottomColor: "#2563eb", fontWeight: 600 },
  summaryRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 },
  summaryCard: {
    background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
    borderTopWidth: 3, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2,
  },
  summaryLabel: { fontSize: 11, color: "#64748b", fontWeight: 500 },
  summaryValue: { fontSize: 18, fontWeight: 700 },
  breakdownRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 },
  breakdownCard: {
    background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
    padding: 12, display: "flex", flexDirection: "column", gap: 6,
  },
  breakdownTitle: { fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 2 },
  breakdownItem: { display: "flex", justifyContent: "space-between", fontSize: 12 },
  breakdownCat: { color: "#64748b" },
  breakdownAmt: { fontWeight: 600, color: "#0f172a" },
  filters: { display: "flex", gap: 6, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  dateInput: { padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, flex: 1, minWidth: 110 },
  select: { padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 },
  list: { display: "flex", flexDirection: "column", gap: 6 },
  entryRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 14px", background: "#fff", borderRadius: 10,
    border: "1px solid #e2e8f0", gap: 10,
  },
  entryLeft: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 },
  entryTop: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  typeBadge: { fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 },
  entryCat: { fontSize: 13, fontWeight: 600, color: "#0f172a" },
  entryDesc: { fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  entryMeta: { display: "flex", alignItems: "center", gap: 6 },
  entryDate: { fontSize: 11, color: "#94a3b8" },
  assignedBadge: {
    fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
    background: "#dbeafe", color: "#1e40af",
  },
  creatorLabel: { fontSize: 10, color: "#94a3b8" },
  entryRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 },
  entryAmount: { fontSize: 16, fontWeight: 700 },
  entryActions: { display: "flex", gap: 4 },
  imgBtn: {
    padding: "3px 8px", borderRadius: 4, border: "1px solid #2563eb",
    background: "#eff6ff", color: "#2563eb", cursor: "pointer", fontSize: 11, fontWeight: 600,
  },
  deleteBtn: {
    padding: "3px 8px", borderRadius: 4, border: "1px solid #e2e8f0",
    background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 11, fontWeight: 600,
  },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40, fontSize: 14 },

  // Add form
  form: { display: "flex", flexDirection: "column", gap: 14, padding: "4px 0" },
  typeToggle: { display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" },
  typeBtn: {
    flex: 1, padding: "14px 0", border: "none", background: "#f8fafc",
    color: "#64748b", cursor: "pointer", fontSize: 15, fontWeight: 600, textAlign: "center",
  },
  typeBtnExpense: { background: "#dc2626", color: "#fff" },
  typeBtnIncome: { background: "#16a34a", color: "#fff" },
  amountWrapper: {
    display: "flex", alignItems: "center", gap: 4,
    background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "8px 16px",
  },
  amountSign: { fontSize: 28, fontWeight: 700, color: "#94a3b8" },
  amountInput: {
    flex: 1, border: "none", outline: "none", fontSize: 32, fontWeight: 700,
    color: "#0f172a", background: "transparent", width: "100%",
  },
  label: { fontSize: 13, fontWeight: 600, color: "#334155", margin: 0 },
  catGrid: { display: "flex", flexWrap: "wrap", gap: 6 },
  catBtn: {
    padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
    background: "#fff", color: "#334155", cursor: "pointer", fontSize: 13, fontWeight: 500,
  },
  catBtnActive: { background: "#0f172a", color: "#fff", borderColor: "#0f172a" },
  input: {
    padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
    fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box",
  },
  uploadArea: { display: "flex", flexDirection: "column", gap: 8 },
  uploadBtn: {
    padding: "16px", borderRadius: 10, border: "2px dashed #cbd5e1",
    background: "#f8fafc", color: "#64748b", cursor: "pointer",
    fontSize: 14, fontWeight: 500, textAlign: "center",
  },
  previewWrap: { display: "flex", alignItems: "center", gap: 12 },
  thumbnail: { width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" },
  removeImg: {
    padding: "6px 12px", borderRadius: 6, border: "1px solid #dc2626",
    background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 12, fontWeight: 600,
  },
  scanningText: { fontSize: 12, color: "#2563eb", fontWeight: 600 },
  confidenceBadge: { fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, alignSelf: "flex-start" },
  rawTextDetails: { background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 12px" },
  rawTextSummary: { fontSize: 12, color: "#64748b", cursor: "pointer", padding: "8px 0" },
  rawTextPre: { fontSize: 11, color: "#334155", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 150, overflow: "auto", margin: "0 0 8px" },
  submitBtn: {
    padding: "16px", borderRadius: 12, border: "none",
    background: "#2563eb", color: "#fff", cursor: "pointer",
    fontSize: 16, fontWeight: 700, marginTop: 8,
  },
};
