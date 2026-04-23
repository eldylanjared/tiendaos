import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { searchProducts, exportProductsCsv, importProductsCsv, bulkDeleteProducts, bulkPatchProducts } from "@/services/api";
import ProductForm from "@/components/Admin/ProductForm";
import ProductTable from "@/components/Admin/ProductTable";
import type { Product } from "@/types";
import toast from "react-hot-toast";
import {
  ColKey, SortDir,
  TOGGLEABLE_COLS,
  colDef, fmt, fmtDate,
  loadVisibleCols, loadColWidths, loadColOrder, DEFAULT_COL_WIDTHS,
  injectDragStyles, pmStyles,
} from "./productManagerDefs";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadColWidths);
  const importRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ dragKey: ColKey | null; overKey: ColKey | null; side: "left" | "right" | null }>({
    dragKey: null, overKey: null, side: null,
  });
  const resizeRef = useRef<{ col: ColKey | null; startX: number; startWidth: number } | null>(null);

  useEffect(() => { injectDragStyles(); }, []);
  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { setPage(0); }, [search]);

  async function loadProducts() {
    try {
      const results = await searchProducts("", 5000);
      setProducts(results);
    } catch { /* ignore */ }
  }

  // --- Filtering & sorting ---
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.barcode.includes(q) ||
      p.barcodes?.some((b) => b.barcode.includes(q))
    );
  }, [products, search]);

  const sortedProducts = useMemo(() => [...filteredProducts].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "name":         return dir * a.name.localeCompare(b.name);
      case "barcode":      return dir * a.barcode.localeCompare(b.barcode);
      case "price":        return dir * (a.price - b.price);
      case "cost":         return dir * (a.cost - b.cost);
      case "stock":        return dir * (a.stock - b.stock);
      case "category":     return dir * ((a.category?.name || "").localeCompare(b.category?.name || ""));
      case "image":        return dir * ((a.image_url ? 1 : 0) - (b.image_url ? 1 : 0));
      case "packs":        return dir * ((a.barcodes?.length ?? 0) - (b.barcodes?.length ?? 0));
      case "sell_by_weight": return dir * ((a.sell_by_weight ? 1 : 0) - (b.sell_by_weight ? 1 : 0));
      case "updated_at":   return dir * (a.updated_at || "").localeCompare(b.updated_at || "");
      case "created_at":   return dir * (a.created_at || "").localeCompare(b.created_at || "");
      default:             return 0;
    }
  }), [filteredProducts, sortKey, sortDir]);

  const totalPages = pageSize > 0 ? Math.ceil(sortedProducts.length / pageSize) : 1;
  const pagedProducts = useMemo(() =>
    pageSize > 0 ? sortedProducts.slice(page * pageSize, (page + 1) * pageSize) : sortedProducts,
  [sortedProducts, page, pageSize]);

  const displayCols = useMemo(() =>
    colOrder.filter((k) => !colDef(k).toggleable || visibleCols.has(k)),
  [colOrder, visibleCols]);

  // --- Helpers passed to ProductTable ---
  const cellHighlight = useCallback((key: ColKey): React.CSSProperties => {
    if (key === dragSourceCol) return { background: "#dbeafe", opacity: 0.5 };
    if (key === dragOverCol)   return { background: "#eff6ff" };
    if (key === flashCol)      return { background: "#bfdbfe", transition: "background 0.6s ease-out" };
    return {};
  }, [dragSourceCol, dragOverCol, flashCol]);

  const sortIndicator = (key: ColKey) => sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  function handleSort(key: ColKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // --- Column visibility ---
  function toggleCol(key: ColKey) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem("productCols", JSON.stringify([...next]));
      return next;
    });
  }

  // --- Drag column reorder ---
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
    setDragSourceCol(null); setDragOverCol(null);
  }
  function onDragOver(e: React.DragEvent, key: ColKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? "left" : "right";
    const el = e.currentTarget as HTMLElement;
    if (dragRef.current.overKey !== key || dragRef.current.side !== side) {
      document.querySelectorAll(".drag-over-left, .drag-over-right").forEach((n) => n.classList.remove("drag-over-left", "drag-over-right"));
      el.classList.add(side === "left" ? "drag-over-left" : "drag-over-right");
      dragRef.current.overKey = key; dragRef.current.side = side;
      setDragOverCol(key);
    }
  }
  function onDragLeave() { setDragOverCol(null); }
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
    setColOrder(order);
    localStorage.setItem("productColOrder", JSON.stringify(order));
    setFlashCol(dragKey);
    setTimeout(() => setFlashCol(null), 600);
  }

  // --- Column resize ---
  const onResizeMouseDown = useCallback((e: React.MouseEvent, col: ColKey) => {
    e.preventDefault(); e.stopPropagation();
    resizeRef.current = { col, startX: e.clientX, startWidth: colWidths[col] ?? DEFAULT_COL_WIDTHS[col] ?? 100 };
    const handle = e.currentTarget as HTMLElement;
    handle.classList.add("resizing");
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const newWidth = Math.max(50, resizeRef.current.startWidth + ev.clientX - resizeRef.current.startX);
      setColWidths((prev) => ({ ...prev, [resizeRef.current!.col!]: newWidth }));
    }
    function onUp() {
      handle.classList.remove("resizing");
      if (resizeRef.current) setColWidths((prev) => { localStorage.setItem("productColWidths", JSON.stringify(prev)); return prev; });
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]);

  // --- Bulk selection ---
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === pagedProducts.length ? new Set() : new Set(pagedProducts.map((p) => p.id)));
  }
  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  // --- Bulk actions ---
  async function handleBulkDelete() {
    if (!window.confirm(`¿Eliminar ${selectedIds.size} productos? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await bulkDeleteProducts([...selectedIds]);
      toast.success(`${res.deleted} productos eliminados`);
      setSelectedIds(new Set()); loadProducts();
    } catch (err: any) { toast.error(err.message || "Error al eliminar"); }
  }
  async function handleBulkDeactivate(active: boolean) {
    try {
      const res = await bulkPatchProducts([...selectedIds], { is_active: active });
      toast.success(`${res.updated} productos ${active ? "activados" : "desactivados"}`);
      setSelectedIds(new Set()); loadProducts();
    } catch (err: any) { toast.error(err.message || "Error al actualizar"); }
  }

  // --- CSV import/export ---
  async function handleExport() {
    try {
      const blob = await exportProductsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "productos.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV descargado");
    } catch (err: any) { toast.error(err.message || "Error al exportar"); }
  }
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true);
    try {
      const result = await importProductsCsv(file);
      toast.success(`Importado: ${result.created} nuevos, ${result.updated} actualizados`);
      if (result.errors.length > 0) { toast.error(`${result.errors.length} errores`); console.warn("Import errors:", result.errors); }
      loadProducts();
    } catch (err: any) { toast.error(err.message || "Error al importar"); }
    finally { setImporting(false); if (importRef.current) importRef.current.value = ""; }
  }

  // --- Barcode scan: Enter with single result opens product ---
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && filteredProducts.length === 1) {
      setSelected(filteredProducts[0]); setSearch("");
    }
  }

  function handleSaved() { setSelected(null); setShowCreate(false); loadProducts(); }

  // --- renderCell (needs drag/highlight state, so lives here) ---
  function renderCell(p: Product, key: ColKey): React.ReactNode {
    const hl = cellHighlight(key);
    switch (key) {
      case "name":    return <td key={key} style={{ ...pmStyles.tdName, ...hl }}><div style={pmStyles.nameCell}>{p.image_url ? <img src={p.image_url} alt="" style={pmStyles.thumb} /> : <div style={pmStyles.thumbPlaceholder}>{p.name.charAt(0).toUpperCase()}</div>}<span style={pmStyles.rowName}>{p.name}</span></div></td>;
      case "barcode": return <td key={key} style={{ ...pmStyles.td, ...pmStyles.barcode, ...hl }}>{p.barcode}</td>;
      case "price":   return <td key={key} style={{ ...pmStyles.td, textAlign: "right", fontWeight: 600, ...hl }}>${fmt(p.price)}</td>;
      case "cost":    return <td key={key} style={{ ...pmStyles.td, textAlign: "right", color: "#64748b", ...hl }}>${fmt(p.cost)}</td>;
      case "stock":   return <td key={key} style={{ ...pmStyles.td, textAlign: "right", color: p.stock <= p.min_stock ? "#dc2626" : "#16a34a", fontWeight: 600, ...hl }}>{p.stock}</td>;
      case "category": return <td key={key} style={{ ...pmStyles.td, ...hl }}>{p.category ? <span style={{ ...pmStyles.badge, background: p.category.color || "#94a3b8" }}>{p.category.name}</span> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>;
      case "image":   return <td key={key} style={{ ...pmStyles.td, textAlign: "center", ...hl }}>{p.image_url ? <span style={pmStyles.yesTag}>Si</span> : <span style={pmStyles.noTag}>No</span>}</td>;
      case "packs":   return <td key={key} style={{ ...pmStyles.td, textAlign: "center", ...hl }}>{(p.barcodes?.length ?? 0) > 0 ? <span style={pmStyles.packTag}>{p.barcodes.length}</span> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>;
      case "sell_by_weight": return <td key={key} style={{ ...pmStyles.td, textAlign: "center", ...hl }}>{p.sell_by_weight ? <span style={pmStyles.weightTag}>Si</span> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>;
      case "updated_at": return <td key={key} style={{ ...pmStyles.td, color: "#64748b", fontSize: 12, ...hl }}>{fmtDate(p.updated_at)}</td>;
      case "created_at": return <td key={key} style={{ ...pmStyles.td, color: "#64748b", fontSize: 12, ...hl }}>{fmtDate(p.created_at)}</td>;
      default:        return null;
    }
  }

  // --- Early returns (after all hooks) ---
  if (showCreate) return <ProductForm onSave={handleSaved} onCancel={() => setShowCreate(false)} />;
  if (selected)   return <ProductForm product={selected} onSave={handleSaved} onCancel={() => setSelected(null)} />;

  return (
    <div>
      {/* Search + New */}
      <div style={pmStyles.toolbar}>
        <input style={pmStyles.search} placeholder="Buscar por nombre o codigo de barras..."
          value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown} />
        <button style={pmStyles.addBtn} onClick={() => setShowCreate(true)}>+ Nuevo</button>
      </div>

      {/* Export / Import / Column picker */}
      <div style={pmStyles.ioBar}>
        <button style={pmStyles.exportBtn} onClick={handleExport}>Exportar CSV</button>
        <button style={pmStyles.importBtn} onClick={() => importRef.current?.click()} disabled={importing}>
          {importing ? "Importando..." : "Importar CSV"}
        </button>
        <input ref={importRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleImport} />
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative" }}>
          <button style={pmStyles.colToggleBtn} onClick={() => setShowColPicker((v) => !v)}>Columnas</button>
          {showColPicker && (
            <div style={pmStyles.colPicker}>
              {TOGGLEABLE_COLS.map((c) => (
                <label key={c.key} style={pmStyles.colCheckLabel}>
                  <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div style={pmStyles.paginationBar}>
        <span style={pmStyles.totalCount}>
          {search ? `${sortedProducts.length} de ${products.length}` : `${products.length} productos`}
        </span>
        <div style={pmStyles.pageSizeWrap}>
          <span style={pmStyles.pageSizeLabel}>Mostrar:</span>
          {[50, 100, 0].map((size) => (
            <button key={size}
              style={pageSize === size ? { ...pmStyles.pageSizeBtn, ...pmStyles.pageSizeBtnActive } : pmStyles.pageSizeBtn}
              onClick={() => { setPageSize(size); setPage(0); }}>
              {size === 0 ? "Todos" : size}
            </button>
          ))}
        </div>
        {pageSize > 0 && totalPages > 1 && (
          <div style={pmStyles.pageNav}>
            <button style={pmStyles.pageBtn} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>&lt; Anterior</button>
            <span style={pmStyles.pageInfo}>{page + 1} / {totalPages}</span>
            <button style={pmStyles.pageBtn} disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Siguiente &gt;</button>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div style={pmStyles.bulkBar}>
          <span style={pmStyles.bulkCount}>{selectedIds.size} seleccionados</span>
          <button style={pmStyles.bulkBtn} onClick={() => handleBulkDeactivate(false)}>Desactivar</button>
          <button style={pmStyles.bulkBtn} onClick={() => handleBulkDeactivate(true)}>Activar</button>
          <button style={{ ...pmStyles.bulkBtn, ...pmStyles.bulkDeleteBtn }} onClick={handleBulkDelete}>Eliminar</button>
          <button style={pmStyles.bulkCancelBtn} onClick={() => setSelectedIds(new Set())}>Cancelar</button>
        </div>
      )}

      {/* Table */}
      <ProductTable
        pagedProducts={pagedProducts}
        allProductsCount={products.length}
        displayCols={displayCols}
        colWidths={colWidths}
        selectedIds={selectedIds}
        onSelect={setSelected}
        onToggle={toggleSelect}
        toggleSelectAll={toggleSelectAll}
        renderCell={renderCell}
        cellHighlight={cellHighlight}
        handleSort={handleSort}
        sortIndicator={sortIndicator}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onResizeMouseDown={onResizeMouseDown}
      />
    </div>
  );
}
