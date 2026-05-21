// Renders the products table: header (drag/sort/resize) + body.
// All state lives in ProductManager.tsx — this component is pure rendering.
import type { Product } from "@/types";
import type { ColKey } from "./productManagerDefs";
import { colDef, pmStyles } from "./productManagerDefs";
import { ProductRow } from "./ProductRow";

interface Props {
  pagedProducts: Product[];
  allProductsCount: number;
  displayCols: ColKey[];
  colWidths: Record<string, number>;
  selectedIds: Set<string>;
  onSelect: (p: Product) => void;
  onToggle: (id: string) => void;
  toggleSelectAll: () => void;
  renderCell: (p: Product, key: ColKey) => React.ReactNode;
  cellHighlight: (key: ColKey) => React.CSSProperties;
  handleSort: (key: ColKey) => void;
  sortIndicator: (key: ColKey) => string;
  onDragStart: (e: React.DragEvent, key: ColKey) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, key: ColKey) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, key: ColKey) => void;
  onResizeMouseDown: (e: React.MouseEvent, col: ColKey) => void;
}

export default function ProductTable({
  pagedProducts, allProductsCount, displayCols, colWidths,
  selectedIds, onSelect, onToggle, toggleSelectAll,
  renderCell, cellHighlight, handleSort, sortIndicator,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onResizeMouseDown,
}: Props) {
  return (
    <div style={pmStyles.tableWrap}>
      <table style={pmStyles.table}>
        <thead>
          <tr>
            <th style={pmStyles.thCheck}>
              <input
                type="checkbox"
                className="pm-cb"
                checked={pagedProducts.length > 0 && selectedIds.size === pagedProducts.length}
                onChange={toggleSelectAll}
              />
            </th>
            {displayCols.map((key) => {
              const def = colDef(key);
              const hl = cellHighlight(key);
              const w = colWidths[key];
              return (
                <th
                  key={key}
                  className="pm-th-drag"
                  style={{ ...pmStyles.thSort, textAlign: def.align, ...hl, width: w, minWidth: w, maxWidth: w, position: "relative" }}
                  draggable
                  onClick={() => handleSort(key)}
                  onDragStart={(e) => onDragStart(e, key)}
                  onDragEnd={onDragEnd}
                  onDragOver={(e) => onDragOver(e, key)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, key)}
                >
                  {def.label}{sortIndicator(key)}
                  <div className="pm-resize-handle" onMouseDown={(e) => onResizeMouseDown(e, key)} />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {pagedProducts.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              selected={selectedIds.has(p.id)}
              displayCols={displayCols}
              onSelect={onSelect}
              onToggle={onToggle}
              renderCell={renderCell}
            />
          ))}
          {allProductsCount === 0 && (
            <tr>
              <td colSpan={99} style={pmStyles.empty}>No se encontraron productos</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
