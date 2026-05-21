// Column definitions, types, utilities, and styles for ProductManager.
// Kept separate so edits to ProductManager.tsx don't risk losing these.

export const ALL_COLUMNS = [
  { key: "name",          label: "Producto",   toggleable: false, default: true,  align: "left"   as const },
  { key: "barcode",       label: "Codigo",     toggleable: false, default: true,  align: "left"   as const },
  { key: "price",         label: "Precio",     toggleable: true,  default: true,  align: "right"  as const },
  { key: "cost",          label: "Costo",      toggleable: true,  default: false, align: "right"  as const },
  { key: "stock",         label: "Stock",      toggleable: true,  default: true,  align: "right"  as const },
  { key: "category",      label: "Categoria",  toggleable: true,  default: false, align: "left"   as const },
  { key: "image",         label: "Imagen",     toggleable: true,  default: false, align: "center" as const },
  { key: "updated_at",    label: "Modificado", toggleable: true,  default: false, align: "left"   as const },
  { key: "created_at",    label: "Creado",     toggleable: true,  default: false, align: "left"   as const },
  { key: "sell_by_weight",label: "Por peso",   toggleable: true,  default: false, align: "center" as const },
  { key: "packs",         label: "Packs",      toggleable: true,  default: true,  align: "center" as const },
] as const;

export type ColKey = (typeof ALL_COLUMNS)[number]["key"];
export type SortDir = "asc" | "desc";

export const DEFAULT_ORDER: ColKey[] = ALL_COLUMNS.map((c) => c.key);
export const TOGGLEABLE_COLS = ALL_COLUMNS.filter((c) => c.toggleable);

export function colDef(key: ColKey) {
  return ALL_COLUMNS.find((c) => c.key === key)!;
}

export function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export const DEFAULT_COL_WIDTHS: Partial<Record<ColKey, number>> = {
  name: 220, barcode: 130, price: 90, cost: 90, stock: 70,
  category: 120, image: 70, updated_at: 110, created_at: 110,
  sell_by_weight: 80, packs: 60,
};

export function loadVisibleCols(): Set<ColKey> {
  try {
    const saved = localStorage.getItem("productCols");
    if (saved) return new Set(JSON.parse(saved) as ColKey[]);
  } catch { /* ignore */ }
  return new Set(TOGGLEABLE_COLS.filter((c) => c.default).map((c) => c.key));
}

export function loadColWidths(): Record<string, number> {
  try {
    const saved = localStorage.getItem("productColWidths");
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

export function loadColOrder(): ColKey[] {
  try {
    const saved = localStorage.getItem("productColOrder");
    if (saved) {
      const order = JSON.parse(saved) as ColKey[];
      const validKeys = new Set(ALL_COLUMNS.map((c) => c.key));
      const filtered = order.filter((k) => validKeys.has(k));
      const missing = ALL_COLUMNS.map((c) => c.key).filter((k) => !filtered.includes(k));
      return [...filtered, ...missing];
    }
  } catch { /* ignore */ }
  return DEFAULT_ORDER;
}

let dragStylesInjected = false;
export function injectDragStyles() {
  if (dragStylesInjected) return;
  dragStylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .pm-th-drag { position: relative; user-select: none; }
    .pm-th-drag.dragging { opacity: 0.4; }
    .pm-th-drag.drag-over-left { border-left: 2px solid #2563eb !important; }
    .pm-th-drag.drag-over-right { border-right: 2px solid #2563eb !important; }
    .pm-resize-handle {
      position: absolute; right: 0; top: 0; bottom: 0; width: 6px;
      cursor: col-resize; z-index: 1;
    }
    .pm-resize-handle:hover, .pm-resize-handle.resizing { background: #2563eb33; }
    .pm-row-selected { background: #eff6ff !important; }
    .pm-row-selected:hover { background: #dbeafe !important; }
    .pm-cb { cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb; }
  `;
  document.head.appendChild(style);
}

export const pmStyles: Record<string, React.CSSProperties> = {
  toolbar:        { display: "flex", gap: 8, marginBottom: 12 },
  search:         { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none" },
  addBtn:         { padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" },
  ioBar:          { display: "flex", gap: 8, marginBottom: 12, alignItems: "center" },
  exportBtn:      { padding: "8px 14px", borderRadius: 8, border: "1px solid #16a34a", background: "#f0fdf4", color: "#16a34a", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  importBtn:      { padding: "8px 14px", borderRadius: 8, border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  colToggleBtn:   { padding: "8px 14px", borderRadius: 8, border: "1px solid #94a3b8", background: "#f8fafc", color: "#475569", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  colPicker:      { position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", minWidth: 180 },
  colCheckLabel:  { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer", whiteSpace: "nowrap" },
  tableWrap:      { overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" },
  table:          { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thSort:         { padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", background: "#f8fafc", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" },
  td:             { padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" },
  tdName:         { padding: "8px 12px", verticalAlign: "middle" },
  nameCell:       { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  thumb:          { width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 },
  thumbPlaceholder: { width: 32, height: 32, borderRadius: 6, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#94a3b8", flexShrink: 0 },
  rowName:        { fontSize: 13, fontWeight: 500, color: "#0f172a" },
  barcode:        { fontSize: 12, color: "#94a3b8", fontFamily: "monospace" },
  badge:          { fontSize: 10, fontWeight: 600, color: "#fff", padding: "2px 6px", borderRadius: 4 },
  weightTag:      { fontSize: 10, fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: 4 },
  packTag:        { fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: 4 },
  yesTag:         { fontSize: 10, fontWeight: 700, background: "#dcfce7", color: "#16a34a", padding: "2px 6px", borderRadius: 4 },
  noTag:          { fontSize: 10, fontWeight: 700, background: "#fef2f2", color: "#dc2626", padding: "2px 6px", borderRadius: 4 },
  empty:          { textAlign: "center", color: "#94a3b8", padding: 40 },
  thCheck:        { padding: "10px 8px", width: 36, background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "center" as const },
  bulkBar:        { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: 8 },
  bulkCount:      { fontSize: 13, fontWeight: 600, color: "#1e40af", marginRight: 4 },
  bulkBtn:        { padding: "5px 12px", borderRadius: 6, border: "1px solid #93c5fd", background: "#fff", color: "#1d4ed8", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  bulkDeleteBtn:  { border: "1px solid #fca5a5", color: "#dc2626" },
  bulkCancelBtn:  { padding: "5px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", cursor: "pointer", fontSize: 13, marginLeft: "auto" },
  paginationBar:  { display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" },
  totalCount:     { fontSize: 13, color: "#64748b", fontWeight: 500 },
  pageSizeWrap:   { display: "flex", alignItems: "center", gap: 4 },
  pageSizeLabel:  { fontSize: 12, color: "#94a3b8", marginRight: 2 },
  pageSizeBtn:    { padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer", fontSize: 12, fontWeight: 500 },
  pageSizeBtnActive: { background: "#2563eb", color: "#fff", borderColor: "#2563eb" },
  pageNav:        { display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" },
  pageBtn:        { padding: "4px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer", fontSize: 12, fontWeight: 500 },
  pageInfo:       { fontSize: 13, color: "#334155", fontWeight: 600 },
};
