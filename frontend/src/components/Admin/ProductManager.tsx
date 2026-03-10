import { useState, useEffect, useRef } from "react";
import { searchProducts, exportProductsCsv, importProductsCsv } from "@/services/api";
import ProductForm from "@/components/Admin/ProductForm";
import type { Product } from "@/types";
import toast from "react-hot-toast";

const COLUMNS = [
  { key: "price", label: "Precio", default: true },
  { key: "cost", label: "Costo", default: false },
  { key: "stock", label: "Stock", default: true },
  { key: "category", label: "Categoria", default: false },
  { key: "image", label: "Imagen", default: false },
  { key: "updated_at", label: "Ultima modificacion", default: false },
  { key: "created_at", label: "Fecha creacion", default: false },
  { key: "sell_by_weight", label: "Por peso", default: false },
  { key: "packs", label: "Packs", default: true },
] as const;

type ColKey = (typeof COLUMNS)[number]["key"];

// All sortable column keys (including the always-visible ones)
type SortKey = "name" | "barcode" | ColKey;
type SortDir = "asc" | "desc";

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
  return new Set(COLUMNS.filter((c) => c.default).map((c) => c.key));
}

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(loadVisibleCols);
  const [showColPicker, setShowColPicker] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortIndicator = (key: SortKey) =>
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

  const show = (k: ColKey) => visibleCols.has(k);

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
              {COLUMNS.map((c) => (
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

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thSort} onClick={() => handleSort("name")}>Producto{sortIndicator("name")}</th>
              <th style={styles.thSort} onClick={() => handleSort("barcode")}>Codigo{sortIndicator("barcode")}</th>
              {show("price") && <th style={{ ...styles.thSort, textAlign: "right" }} onClick={() => handleSort("price")}>Precio{sortIndicator("price")}</th>}
              {show("cost") && <th style={{ ...styles.thSort, textAlign: "right" }} onClick={() => handleSort("cost")}>Costo{sortIndicator("cost")}</th>}
              {show("stock") && <th style={{ ...styles.thSort, textAlign: "right" }} onClick={() => handleSort("stock")}>Stock{sortIndicator("stock")}</th>}
              {show("category") && <th style={styles.thSort} onClick={() => handleSort("category")}>Categoria{sortIndicator("category")}</th>}
              {show("image") && <th style={{ ...styles.thSort, textAlign: "center" }} onClick={() => handleSort("image")}>Imagen{sortIndicator("image")}</th>}
              {show("packs") && <th style={{ ...styles.thSort, textAlign: "center" }} onClick={() => handleSort("packs")}>Packs{sortIndicator("packs")}</th>}
              {show("sell_by_weight") && <th style={{ ...styles.thSort, textAlign: "center" }} onClick={() => handleSort("sell_by_weight")}>Peso{sortIndicator("sell_by_weight")}</th>}
              {show("updated_at") && <th style={styles.thSort} onClick={() => handleSort("updated_at")}>Modificado{sortIndicator("updated_at")}</th>}
              {show("created_at") && <th style={styles.thSort} onClick={() => handleSort("created_at")}>Creado{sortIndicator("created_at")}</th>}
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((p) => (
              <tr key={p.id} style={styles.tr} onClick={() => setSelected(p)}>
                <td style={styles.td}>
                  <div style={styles.nameCell}>
                    {p.image_url ? (
                      <img src={p.image_url} alt="" style={styles.thumb} />
                    ) : (
                      <div style={styles.thumbPlaceholder}>{p.name.charAt(0).toUpperCase()}</div>
                    )}
                    <span style={styles.rowName}>{p.name}</span>
                  </div>
                </td>
                <td style={{ ...styles.td, ...styles.barcode }}>{p.barcode}</td>
                {show("price") && (
                  <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>
                    ${fmt(p.price)}
                  </td>
                )}
                {show("cost") && (
                  <td style={{ ...styles.td, textAlign: "right", color: "#64748b" }}>
                    ${fmt(p.cost)}
                  </td>
                )}
                {show("stock") && (
                  <td
                    style={{
                      ...styles.td,
                      textAlign: "right",
                      color: p.stock <= p.min_stock ? "#dc2626" : "#16a34a",
                      fontWeight: 600,
                    }}
                  >
                    {p.stock}
                  </td>
                )}
                {show("category") && (
                  <td style={styles.td}>
                    {p.category ? (
                      <span
                        style={{
                          ...styles.badge,
                          background: p.category.color || "#94a3b8",
                        }}
                      >
                        {p.category.name}
                      </span>
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>—</span>
                    )}
                  </td>
                )}
                {show("image") && (
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    {p.image_url ? (
                      <span style={styles.yesTag}>Si</span>
                    ) : (
                      <span style={styles.noTag}>No</span>
                    )}
                  </td>
                )}
                {show("packs") && (
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    {p.barcodes.length > 0 ? (
                      <span style={styles.packTag}>{p.barcodes.length}</span>
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>—</span>
                    )}
                  </td>
                )}
                {show("sell_by_weight") && (
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    {p.sell_by_weight ? (
                      <span style={styles.weightTag}>Si</span>
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>—</span>
                    )}
                  </td>
                )}
                {show("updated_at") && (
                  <td style={{ ...styles.td, color: "#64748b", fontSize: 12 }}>
                    {fmtDate(p.updated_at)}
                  </td>
                )}
                {show("created_at") && (
                  <td style={{ ...styles.td, color: "#64748b", fontSize: 12 }}>
                    {fmtDate(p.created_at)}
                  </td>
                )}
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
  th: {
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
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 280,
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
};
