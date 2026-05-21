import { useState } from "react";
import type { Product } from "@/types";

interface Props {
  product: Product;
  onConfirm: (price: number) => void;
  onClose: () => void;
}

export default function PriceInputModal({ product, onConfirm, onClose }: Props) {
  const [input, setInput] = useState("");

  const price = parseFloat(input) || 0;

  function handleKey(key: string) {
    if (key === "backspace") {
      setInput((prev) => prev.slice(0, -1));
    } else if (key === ".") {
      if (!input.includes(".")) setInput((prev) => prev + ".");
    } else {
      setInput((prev) => prev + key);
    }
  }

  function handleConfirm() {
    if (price > 0) onConfirm(price);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>{product.name}</h3>
        <p style={styles.subtitle}>Ingresa el precio para esta venta</p>

        <div style={styles.display}>
          <span style={styles.currency}>$</span>
          <span style={styles.priceValue}>{input || "0"}</span>
        </div>

        <div style={styles.numpad}>
          {keys.map((key) => (
            <button
              key={key}
              style={key === "backspace" ? { ...styles.key, fontSize: 18 } : styles.key}
              onClick={() => handleKey(key)}
            >
              {key === "backspace" ? "\u232B" : key}
            </button>
          ))}
        </div>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button
            style={{ ...styles.confirmBtn, ...(price <= 0 ? styles.disabled : {}) }}
            onClick={handleConfirm}
            disabled={price <= 0}
          >
            Agregar {price > 0 ? `$${price.toFixed(2)}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    width: 340,
    textAlign: "center",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" },
  subtitle: { margin: "4px 0 16px", fontSize: 14, color: "#64748b" },
  display: {
    background: "#f1f5f9",
    borderRadius: 10,
    padding: "16px 20px",
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
    marginBottom: 16,
  },
  currency: { fontSize: 22, fontWeight: 600, color: "#64748b" },
  priceValue: { fontSize: 36, fontWeight: 700, color: "#0f172a" },
  numpad: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginBottom: 16,
  },
  key: {
    padding: 14,
    fontSize: 20,
    fontWeight: 600,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    color: "#0f172a",
  },
  actions: { display: "flex", gap: 8 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "#64748b",
  },
  confirmBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  disabled: { background: "#cbd5e1", cursor: "default" },
};
