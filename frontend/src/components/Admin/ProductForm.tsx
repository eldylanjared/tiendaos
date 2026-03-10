import { useState, useEffect, useRef } from "react";
import {
  createProduct,
  updateProduct,
  addProductBarcode,
  deleteProductBarcode,
  addVolumePromo,
  deleteVolumePromo,
  getProduct,
  getCategories,
  uploadProductImage,
} from "@/services/api";
import type { Product, Category } from "@/types";
import toast from "react-hot-toast";

interface Props {
  product?: Product;
  onSave: () => void;
  onCancel: () => void;
}

export default function ProductForm({ product, onSave, onCancel }: Props) {
  const isEdit = !!product;

  const [form, setForm] = useState({
    barcode: product?.barcode ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? "",
    price: product?.price ?? 0,
    cost: product?.cost ?? 0,
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 5,
    sell_by_weight: product?.sell_by_weight ?? false,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [imagePreview, setImagePreview] = useState<string>(product?.image_url || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [barcodes, setBarcodes] = useState(product?.barcodes ?? []);
  const [promos, setPromos] = useState(product?.volume_promos ?? []);

  const [newBarcode, setNewBarcode] = useState("");
  const [newUnits, setNewUnits] = useState(1);
  const [newPackPrice, setNewPackPrice] = useState(0);

  const [newMinUnits, setNewMinUnits] = useState(1);
  const [newPromoPrice, setNewPromoPrice] = useState(0);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  function setField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
    if (!form.barcode || !form.name || form.price <= 0) {
      toast.error("Barcode, nombre y precio son requeridos");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!payload.category_id) delete payload.category_id;

      let savedProduct: Product;
      if (isEdit) {
        savedProduct = await updateProduct(product.id, payload);
      } else {
        savedProduct = await createProduct(payload as any);
      }

      // Upload image if selected
      if (imageFile) {
        await uploadProductImage(savedProduct.id, imageFile);
      }

      toast.success(isEdit ? "Producto actualizado" : "Producto creado");
      onSave();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddBarcode() {
    if (!product || !newBarcode || newUnits < 1 || newPackPrice <= 0) return;
    try {
      await addProductBarcode(product.id, newBarcode, newUnits, newPackPrice);
      const updated = await getProduct(product.id);
      setBarcodes(updated.barcodes);
      setNewBarcode("");
      setNewUnits(1);
      setNewPackPrice(0);
      toast.success("Barcode de pack agregado");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDeleteBarcode(barcodeId: string) {
    if (!product) return;
    try {
      await deleteProductBarcode(product.id, barcodeId);
      setBarcodes((prev) => prev.filter((b) => b.id !== barcodeId));
      toast.success("Barcode eliminado");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleAddPromo() {
    if (!product || newMinUnits < 1 || newPromoPrice <= 0) return;
    try {
      await addVolumePromo(product.id, newMinUnits, newPromoPrice);
      const updated = await getProduct(product.id);
      setPromos(updated.volume_promos);
      setNewMinUnits(1);
      setNewPromoPrice(0);
      toast.success("Promo de volumen agregada");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDeletePromo(promoId: string) {
    if (!product) return;
    try {
      await deleteVolumePromo(product.id, promoId);
      setPromos((prev) => prev.filter((p) => p.id !== promoId));
      toast.success("Promo eliminada");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onCancel}>&larr; Volver</button>
        <h2 style={styles.title}>{isEdit ? "Editar Producto" : "Nuevo Producto"}</h2>
      </div>

      <div style={styles.grid}>
        <label style={styles.label}>
          Barcode
          <input style={styles.input} value={form.barcode} onChange={(e) => setField("barcode", e.target.value)} />
        </label>
        <label style={styles.label}>
          Nombre
          <input style={styles.input} value={form.name} onChange={(e) => setField("name", e.target.value)} />
        </label>
        <label style={styles.label}>
          Precio
          <input style={styles.input} type="number" step="0.01" value={form.price} onChange={(e) => setField("price", parseFloat(e.target.value) || 0)} />
        </label>
        <label style={styles.label}>
          Costo
          <input style={styles.input} type="number" step="0.01" value={form.cost} onChange={(e) => setField("cost", parseFloat(e.target.value) || 0)} />
        </label>
        <label style={styles.label}>
          Categoria
          <select
            style={styles.input}
            value={form.category_id}
            onChange={(e) => setField("category_id", e.target.value)}
          >
            <option value="">Sin categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          Descripcion
          <input style={styles.input} value={form.description} onChange={(e) => setField("description", e.target.value)} />
        </label>
        <label style={styles.label}>
          Stock
          <input style={styles.input} type="number" value={form.stock} onChange={(e) => setField("stock", parseInt(e.target.value) || 0)} />
        </label>
        <label style={styles.label}>
          Stock Min.
          <input style={styles.input} type="number" value={form.min_stock} onChange={(e) => setField("min_stock", parseInt(e.target.value) || 0)} />
        </label>
        <label style={styles.checkLabel}>
          <input type="checkbox" checked={form.sell_by_weight} onChange={(e) => setField("sell_by_weight", e.target.checked)} />
          Venta por peso (kg)
        </label>
      </div>

      {/* Image upload */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Foto del Producto</h3>
        <div style={styles.imageArea}>
          {imagePreview ? (
            <div style={styles.imagePreviewWrap}>
              <img src={imagePreview} style={styles.imageThumb} alt="Producto" />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.changeImgBtn} onClick={() => fileRef.current?.click()}>Cambiar</button>
                <button style={styles.removeImgBtn} onClick={() => { setImageFile(null); setImagePreview(""); if (fileRef.current) fileRef.current.value = ""; }}>Quitar</button>
              </div>
            </div>
          ) : (
            <button style={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
              Subir Foto
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />
        </div>
      </div>

      {/* Pack Barcodes Section */}
      {isEdit && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Barcodes de Pack</h3>
          {barcodes.map((b) => (
            <div key={b.id} style={styles.subRow}>
              <span>{b.barcode} - x{b.units} - ${b.pack_price.toFixed(2)}</span>
              <button style={styles.deleteBtn} onClick={() => handleDeleteBarcode(b.id)}>Eliminar</button>
            </div>
          ))}
          <div style={styles.subForm}>
            <input style={styles.smallInput} placeholder="Barcode" value={newBarcode} onChange={(e) => setNewBarcode(e.target.value)} />
            <input style={styles.smallInput} type="number" placeholder="Uds" value={newUnits} onChange={(e) => setNewUnits(parseInt(e.target.value) || 1)} />
            <input style={styles.smallInput} type="number" step="0.01" placeholder="Precio pack" value={newPackPrice || ""} onChange={(e) => setNewPackPrice(parseFloat(e.target.value) || 0)} />
            <button style={styles.addSubBtn} onClick={handleAddBarcode}>Agregar</button>
          </div>
        </div>
      )}

      {/* Volume Promos Section */}
      {isEdit && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Promos de Volumen</h3>
          {promos.map((p) => (
            <div key={p.id} style={styles.subRow}>
              <span>{p.min_units} x ${p.promo_price.toFixed(2)} (${(p.promo_price / p.min_units).toFixed(2)} c/u)</span>
              <button style={styles.deleteBtn} onClick={() => handleDeletePromo(p.id)}>Eliminar</button>
            </div>
          ))}
          <div style={styles.subForm}>
            <input style={styles.smallInput} type="number" placeholder="Cantidad" value={newMinUnits} onChange={(e) => setNewMinUnits(parseInt(e.target.value) || 1)} />
            <input style={styles.smallInput} type="number" step="0.01" placeholder="Precio total paquete" value={newPromoPrice || ""} onChange={(e) => setNewPromoPrice(parseFloat(e.target.value) || 0)} />
            <button style={styles.addSubBtn} onClick={handleAddPromo}>Agregar</button>
          </div>
        </div>
      )}

      <div style={styles.actions}>
        <button style={styles.cancelBtn} onClick={onCancel}>Cancelar</button>
        <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 700 },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 20,
  },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 500, color: "#334155" },
  input: {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 500,
    color: "#334155",
    gridColumn: "span 2",
  },
  section: {
    marginBottom: 20,
    padding: 14,
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  sectionTitle: { margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "#0f172a" },
  imageArea: { display: "flex", flexDirection: "column", gap: 8 },
  imagePreviewWrap: { display: "flex", alignItems: "center", gap: 12 },
  imageThumb: { width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" },
  uploadBtn: {
    padding: "12px 20px",
    borderRadius: 8,
    border: "2px dashed #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  changeImgBtn: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  removeImgBtn: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #dc2626",
    background: "#fff",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  subRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 13,
    color: "#334155",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  subForm: { display: "flex", gap: 6, marginTop: 8 },
  smallInput: {
    flex: 1,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 13,
  },
  addSubBtn: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  actions: { display: "flex", gap: 8, marginTop: 16 },
  cancelBtn: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    color: "#64748b",
  },
  saveBtn: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
};
