import { memo } from "react";
import type { Product } from "@/types";
import type { ColKey } from "./productManagerDefs";

export const ProductRow = memo(function ProductRow({
  product, selected, displayCols, onSelect, onToggle, renderCell,
}: {
  product: Product;
  selected: boolean;
  displayCols: ColKey[];
  onSelect: (p: Product) => void;
  onToggle: (id: string) => void;
  renderCell: (p: Product, key: ColKey) => React.ReactNode;
}) {
  return (
    <tr
      className={selected ? "pm-row-selected" : undefined}
      style={{ cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
      onClick={() => onSelect(product)}
    >
      <td
        style={{ padding: "8px 8px", width: 36, textAlign: "center", verticalAlign: "middle" }}
        onClick={(e) => { e.stopPropagation(); onToggle(product.id); }}
      >
        <input
          type="checkbox"
          className="pm-cb"
          checked={selected}
          onChange={(e) => { e.stopPropagation(); onToggle(product.id); }}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      {displayCols.map((key) => renderCell(product, key))}
    </tr>
  );
});
