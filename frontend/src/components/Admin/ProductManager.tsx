import { useState, useEffect, useRef } from "react";
import { searchProducts, exportProductsCsv, importProductsCsv } from "@/services/api";
import ProductForm from "@/components/Admin/ProductForm";
import type { Product } from "@/types";
import toast from "react-hot-toast";

// Every column definition — "name" and "barcode" are always visible
const ALL_COLUMNS = [
  { key: "name", label: "Producto", toggleable: false, align: "left" as const },
  { key: "barcode", label: "Codigo", toggleable: false, align: "left" as const },
  { key: "price", label: "Precio", toggleable: true, default: true, align: "right" as const },
  { key: "cost", label: "Costo", toggleable: true, default: false, align: "right" as const },
  { key: "stock", label: "Stock", toggleable: true, default: true, align: "right" as const },
  { key: "category", label: "Categoria", toggleable: true, default: false, align: "left" as const },
  { key: "image", label: "Imagen", toggleable: true, default: false, align: "center" as const },
  { key: "updated_at", label: "Modificado", toggleable: true, default: false, align: "left" as const },
  { key: "created_at", label: "Creado", toggleable: true, default: false, align: "left" as const },
  { key: "sell_by_weight", label: "Por peso", toggleable: true, default: false, align: "center" as const },
  { key: "packs", label: "Packs", toggleable: true, default: true, align: "center" as const },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]["key"];
type SortDir = "asc" | "desc";

const DEFAULT_ORDER: ColKey[] = ALL_COLUMNS.map((c) => c.key);
const TOGGLEABLE_COLS = ALL_COLUMNS.filter((c) => c.toggleable);

function colDef(key: ColKey) {
  return ALL_COLUMNS.find((c) => c.key === key)!;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function loadVisibleCols(): Set<ColKey> {
  try {
    const saved = localStorage.getItem("productCols");
    if (saved) return new Set(JSON.parse(saved) as ColKey[]);
  } catch { /* ignore */ }
  return new Set(TOGGLEABLE_COLS.filter((c) => c.default).map((c) => c.key));
}

function loadColOrder(): ColKey[] {
  try {
    const saved = localStorage.getItem("productColOrder");
    if (saved) {
      const order = JSON.parse(saved) as ColKey[];
      // Ensure all columns are present (in case new ones were added)
      const set = new Set(order);
      for (const c of DEFAULT_ORDER) {
        if (!set.has(c)) order.push(c);
      }
      return order.filter((k) => ALL_COLUMNS.some((c) => c.key === k));
    }
  } catch { /* ignore */ }
  return [...DEFAULT_ORDER];
}

// Inject drag styles once
let dragStyleInjected = false;
function injectDragStyles() {
  if (dragStyleInjected) return;
  dragStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .pm-th-drag {
      cursor: grab;
      user-select: none;
      transition: background 0.15s, transform 0.15s;
    }
    .pm-th-drag:active { cursor: grabbing; }
    .pm-th-drag.dragging {
      opacity: 0.35;
      background: #dbeafe !important;
      color: #2563eb !important;
      transform: scale(0.95);
    }
    .pm-th-drag.drag-over-left {
      box-shadow: inset 4px 0 0 #2563eb;
      background: #eff6ff !important;
    }
    .pm-th-drag.drag-over-right {
      box-shadow: inset -4px 0 0 #2563eb;
      background: #eff6ff !important;
    }
    .pm-col-highlight {
      background: #eff6ff !important;
      transition: background 0.3s;
    }
    @keyframes pm-col-flash {
      0% { background: #bfdbfe; }
      100% { background: transparent; }
    }
    .pm-col-flash td, .pm-col-flash th {
      animation: pm-col-flash 0.6s ease-out;
    }
  `;
  document.head.appendChild(style);
}

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(loadVisibleCols);
  const [showColPicker, setShowColPicker] = useState(false);
  const [sortKey, setSortKey] = useState<ColKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [colOrder, setColOrder] = useState<ColKey[]>(loadColOrder);
  const [dragSourceCol, setDragSourceCol] = useState<ColKey | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColKey | null>(null);
  const [flashCol, setFlashCol] = useState<ColKey | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Drag state — not in React state to avoid re-renders during drag
  const dragRef = useRef<{ dragKey: ColKey | null; overKey: ColKey | null; side: "left" | "right" | null }>({
    dragKey: null, overKey: null, side: null,
  });

  useEffect(() => { injectDragStyles(); }, []);

  useEffect(() => {
    setPage(0);
    loadProducts();
  }, [search]);

  async function loadProducts() {
    try {
      const results = await searchProducts(search, 5000);
      setProducts(results);
    } catch { /* ignore */ }
  }

  function handleSaved() {
    setSelected(null);
    setShowCreate(false);
    loadProducts();
  }

  function toggleCol(key: ColKey) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem("productCols", JSON.stringify([...next]));
      return next;
    });
  }

  function saveColOrder(order: ColKey[]) {
    setColOrder(order);
    localStorage.setItem("productColOrder", JSON.stringify(order));
  }

  // -- Drag handlers --
  function onDragStart(e: React.DragEvent, key: ColKey) {
    dragRef.current.dragKey = key;
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).classList.add("dragging");
    setDragSourceCol(key);
  }

  function onDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).classList.remove("dragging");
    document.querySelectorAll(".drag-over-left, .drag-over-right").forEach((el) => {
      el.classList.remove("drag-over-left", "drag-over-right");
    });
    dragRef.current = { dragKey: null, overKey: null, side: null };
    setDragSourceCol(null);
    setDragOverCol(null);
  }

  function onDragOver(e: React.DragEvent, key: ColKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const side = e.clientX < midX ? "left" : "right";
    const el = e.currentTarget as HTMLElement;

    if (dragRef.current.overKey !== key || dragRef.current.side !== side) {
      document.querySelectorAll(".drag-over-left, .drag-over-right").forEach((n) => {
        n.classList.remove("drag-over-left", "drag-over-right");
      });
      el.classList.add(side === "left" ? "drag-over-left" : "drag-over-right");
      dragRef.current.overKey = key;
      dragRef.current.side = side;
      setDragOverCol(key);
    }
  }

  function onDragLeave() {
    setDragOverCol(null);
  }

  function onDrop(e: React.DragEvent, targetKey: ColKey) {
    e.preventDefault();
    const { dragKey, side } = dragRef.current;
    if (!dragKey || dragKey === targetKey) return;

    const order = [...colOrder];
    const fromIdx = order.indexOf(dragKey);
    if (fromIdx === -1) return;
    order.splice(fromIdx, 1);
    let toIdx = order.indexOf(targetKey);
    if (side === "right") toIdx += 1;
    order.splice(toIdx, 0, dragKey);
    saveColOrder(order);

    // Flash the moved column briefly
    setFlashCol(dragKey);
    setTimeout(() => setFlashCol(null), 600);
  }

  async function handleExport() {
    try {
      const blob = await exportProductsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "productos.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV descargado");
    } catch (err: any) {
      toast.error(err.message || "Error al exportar");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importProductsCsv(file);
      toast.success(`Importado: ${result.created} nuevos, ${result.updated} actualizados`);
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} errores — revisa la consola`);
        console.warn("Import errors:", result.errors);
      }
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Error al importar");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  if (showCreate) {
    return <ProductForm onSave={handleSaved} onCancel={() => setShowCreate(false)} />;
  }

  if (selected) {
    return <ProductForm product={selected} onSave={handleSaved} onCancel={() => setSelected(null)} />;
  }

  function handleSort(key: ColKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortIndicator = (key: ColKey) =>
    sortKey === key ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";

  const sortedProducts = [...products].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "name": return dir * a.name.localeCompare(b.name);
      case "barcode": return dir * a.barcode.localeCompare(b.barcode);
      case "price": return dir * (a.price - b.price);
      case "cost": return dir * (a.cost - b.cost);
      case "stock": return dir * (a.stock - b.stock);
      case "category": {
        const ca = a.category?.name || "";
        const cb = b.category?.name || "";
        return dir * ca.localeCompare(cb);
      }
      case "image": return dir * ((a.image_url ? 1 : 0) - (b.image_url ? 1 : 0));
      case "packs": return dir * (a.barcodes.length - b.barcodes.length);
      case "sell_by_weight": return dir * ((a.sell_by_weight ? 1 : 0) - (b.sell_by_weight ? 1 : 0));
      case "updated_at": return dir * (a.updated_at || "").localeCompare(b.updated_at || "");
      case "created_at": return dir * (a.created_at || "").localeCompare(b.created_at || "");
      default: return 0;
    }
  });

  const totalPages = pageSize > 0 ? Math.ceil(sortedProducts.length / pageSize) : 1;
  const pagedProducts = pageSize > 0
    ? sortedProducts.slice(page * pageSize, (page + 1) * pageSize)
    : sortedProducts;

  // Visible columns in user-defined order
  const displayCols = colOrder.filter((k) => {
    const def = colDef(k);
    if (!def.toggleable) return true; // name, barcode always shown
    return visibleCols.has(k);
  });

  function cellHighlight(key: ColKey): React.CSSProperties {
    if (key === dragSourceCol) return { background: "#dbeafe", opacity: 0.5 };
    if (key === dragOverCol) return { background: "#eff6ff" };
    if (key === flashCol) return { background: "#bfdbfe", transition: "background 0.6s ease-out" };
    return {};
  }

  function renderCell(p: Product, key: ColKey) {
    const hl = cellHighlight(key);
    switch (key) {
      case "name":
        return (
          <td key={key} style={{ ...styles.tdName, ...hl }}>
            <div style={styles.nameCell}>
              {p.image_url ? (
                <img src={p.image_url} alt="" style={styles.thumb} />
              ) : (
                <div style={styles.thumbPlaceholder}>{p.name.charAt(0).toUpperCase()}</div>
              )}
              <span style={styles.rowName}>{p.name}</span>
            </div>
          </td>
        );
      case "barcode":
        return <td key={key} style={{ ...styles.td, ...styles.barcode, ...hl }}>{p.barcode}</td>;
      case "price":
        return <td key={key} style={{ ...styles.td, textAlign: "right", fontWeight: 600, ...hl }}>${fmt(p.price)}</td>;
      case "cost":
        return <td key={key} style={{ ...styles.td, textAlign: "right", color: "#64748b", ...hl }}>${fmt(p.cost)}</td>;
      case "stock":
        return (
          <td key={key} style={{ ...styles.td, textAlign: "right", color: p.stock <= p.min_stock ? "#dc2626" : "#16a34a", fontWeight: 600, ...hl }}>
            {p.stock}
          </td>
        );
      case "category":
        return (
          <td key={key} style={{ ...styles.td, ...hl }}>
            {p.category ? (
              <span style={{ ...styles.badge, background: p.category.color || "#94a3b8" }}>{p.category.name}</span>
            ) : (
              <span style={{ color: "#cbd5e1" }}>—</span>
            )}
          </td>
        );
      case "image":
        return (
          <td key={key} style={{ ...styles.td, textAlign: "center", ...hl }}>
            {p.image_url ? <span style={styles.yesTag}>Si</span> : <span style={styles.noTag}>No</span>}
          </td>
        );
      case "packs":
        return (
          <td key={key} style={{ ...styles.td, textAlign: "center", ...hl }}>
            {p.barcodes.length > 0 ? <span style={styles.packTag}>{p.barcodes.length}</span> : <span style={{ color: "#cbd5e1" }}>—</span>}
          </td>
        );
      case "sell_by_weight":
        return (
          <td key={key} style={{ ...styles.td, textAlign: "center", ...hl }}>
            {p.sell_by_weight ? <span style={styles.weightTag}>Si</span> : <span style={{ color: "#cbd5e1" }}>—</span>}
          </td>
        );
      case "updated_at":
        return <td key={key} style={{ ...styles.td, color: "#64748b", fontSize: 12, ...hl }}>{fmtDate(p.updated_at)}</td>;
      case "created_at":
        return <td key={key} style={{ ...styles.td, color: "#64748b", fontSize: 12, ...hl }}>{fmtDate(p.created_at)}</td>;
      default:
        return null;
    }
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <input
          style={styles.search}
          placeholder="Buscar productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button style={styles.addBtn} onClick={() => setShowCreate(true)}>
          + Nuevo
        </button>
      </div>
      <div style={styles.ioBar}>
        <button style={styles.exportBtn} onClick={handleExport}>
          Exportar CSV
        </button>
        <button
          style={styles.importBtn}
          onClick={() => importRef.current?.click()}
          disabled={importing}
        >
          {importing ? "Importando..." : "Importar CSV"}
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleImport}
        />
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative" }}>
          <button
            style={styles.colToggleBtn}
            onClick={() => setShowColPicker((v) => !v)}
          >
            Columnas
          </button>
          {showColPicker && (
            <div style={styles.colPicker}>
              {TOGGLEABLE_COLS.map((c) => (
                <label key={c.key} style={styles.colCheckLabel}>
                  <input
                    type="checkbox"
                    checked={visibleCols.has(c.key)}
                    onChange={() => toggleCol(c.key)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pagination bar */}
      <div style={styles.paginationBar}>
        <span style={styles.totalCount}>{sortedProducts.length} productos</span>
        <div style={styles.pageSizeWrap}>
          <span style={styles.pageSizeLabel}>Mostrar:</span>
          {[50, 100, 0].map((size) => (
            <button
              key={size}
              style={pageSize === size ? { ...styles.pageSizeBtn, ...styles.pageSizeBtnActive } : styles.pageSizeBtn}
              onClick={() => { setPageSize(size); setPage(0); }}
            >
              {size === 0 ? "Todos" : size}
            </button>
          ))}
        </div>
        {pageSize > 0 && totalPages > 1 && (
          <div style={styles.pageNav}>
            <button
              style={styles.pageBtn}
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              &lt; Anterior
            </button>
            <span style={styles.pageInfo}>
              {page + 1} / {totalPages}
            </span>
            <button
              style={styles.pageBtn}
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente &gt;
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {displayCols.map((key) => {
                const def = colDef(key);
                const hl = cellHighlight(key);
                return (
                  <th
                    key={key}
                    className="pm-th-drag"
                    style={{ ...styles.thSort, textAlign: def.align, ...hl }}
                    draggable
                    onClick={() => handleSort(key)}
                    onDragStart={(e) => onDragStart(e, key)}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => onDragOver(e, key)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, key)}
                  >
                    {def.label}{sortIndicator(key)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedProducts.map((p) => (
              <tr key={p.id} style={styles.tr} onClick={() => setSelected(p)}>
                {displayCols.map((key) => renderCell(p, key))}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={99} style={styles.empty}>
                  No se encontraron productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: "flex", gap: 8, marginBottom: 12 },
  search: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
  },
  addBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  ioBar: { display: "flex", gap: 8, marginBottom: 12, alignItems: "center" },
  exportBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #16a34a",
    background: "#f0fdf4",
    color: "#16a34a",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  importBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  colToggleBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #94a3b8",
    background: "#f8fafc",
    color: "#475569",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  colPicker: {
    position: "absolute",
    right: 0,
    top: "100%",
    marginTop: 4,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    zIndex: 10,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    minWidth: 180,
  },
  colCheckLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#334155",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  thSort: {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "2px solid #e2e8f0",
    background: "#f8fafc",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
  },
  tr: {
    cursor: "pointer",
    borderBottom: "1px solid #f1f5f9",
  },
  td: {
    padding: "8px 12px",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  tdName: {
    padding: "8px 12px",
    verticalAlign: "middle",
  },
  nameCell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    objectFit: "cover",
    flexShrink: 0,
  },
  thumbPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#94a3b8",
    flexShrink: 0,
  },
  rowName: {
    fontSize: 13,
    fontWeight: 500,
    color: "#0f172a",
  },
  barcode: {
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: "monospace",
  },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 4,
  },
  weightTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#fef3c7",
    color: "#92400e",
    padding: "2px 6px",
    borderRadius: 4,
  },
  packTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#dbeafe",
    color: "#1e40af",
    padding: "2px 6px",
    borderRadius: 4,
  },
  yesTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#dcfce7",
    color: "#16a34a",
    padding: "2px 6px",
    borderRadius: 4,
  },
  noTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#fef2f2",
    color: "#dc2626",
    padding: "2px 6px",
    borderRadius: 4,
  },
  empty: {
    textAlign: "center",
    color: "#94a3b8",
    padding: 40,
  },
  paginationBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  totalCount: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 500,
  },
  pageSizeWrap: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  pageSizeLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginRight: 2,
  },
  pageSizeBtn: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#475569",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  pageSizeBtnActive: {
    background: "#2563eb",
    color: "#fff",
    borderColor: "#2563eb",
  },
  pageNav: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  pageBtn: {
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#475569",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  pageInfo: {
    fontSize: 13,
    color: "#334155",
    fontWeight: 600,
  },
};
