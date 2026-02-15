import { useState, useEffect } from "react";
import { getUsers, createUser, updateUser } from "@/services/api";
import type { User } from "@/types";
import toast from "react-hot-toast";

export default function EmployeeManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  // Create form
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    password: "",
    pin_code: "",
    role: "cashier",
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    full_name: "",
    role: "",
    pin_code: "",
    password: "",
  });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setUsers(await getUsers());
    } catch { /* ignore */ }
  }

  function startEdit(user: User) {
    setEditing(user);
    setEditForm({ full_name: user.full_name, role: user.role, pin_code: "", password: "" });
  }

  async function handleCreate() {
    if (!form.username || !form.full_name || !form.password || !form.pin_code) {
      toast.error("Todos los campos son requeridos");
      return;
    }
    try {
      await createUser({ ...form, store_id: "store-1" });
      toast.success("Empleado creado");
      setShowCreate(false);
      setForm({ username: "", full_name: "", password: "", pin_code: "", role: "cashier" });
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    const data: Record<string, unknown> = {};
    if (editForm.full_name !== editing.full_name) data.full_name = editForm.full_name;
    if (editForm.role !== editing.role) data.role = editForm.role;
    if (editForm.pin_code) data.pin_code = editForm.pin_code;
    if (editForm.password) data.password = editForm.password;
    if (Object.keys(data).length === 0) {
      setEditing(null);
      return;
    }
    try {
      await updateUser(editing.id, data);
      toast.success("Empleado actualizado");
      setEditing(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function toggleActive(user: User) {
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      toast.success(user.is_active ? "Empleado desactivado" : "Empleado activado");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <h3 style={styles.title}>Empleados</h3>
        <button style={styles.addBtn} onClick={() => setShowCreate(true)}>+ Nuevo Empleado</button>
      </div>

      {showCreate && (
        <div style={styles.formCard}>
          <h4 style={styles.formTitle}>Crear Empleado</h4>
          <div style={styles.formGrid}>
            <input style={styles.input} placeholder="Usuario" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input style={styles.input} placeholder="Nombre completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <input style={styles.input} placeholder="Contrasena" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <input style={styles.input} placeholder="PIN (4 digitos)" maxLength={4} value={form.pin_code} onChange={(e) => setForm({ ...form, pin_code: e.target.value })} />
            <select style={styles.input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="cashier">Cajero</option>
              <option value="manager">Gerente</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div style={styles.formActions}>
            <button style={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancelar</button>
            <button style={styles.saveBtn} onClick={handleCreate}>Crear</button>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {users.map((user) => (
          <div key={user.id} style={styles.row}>
            {editing?.id === user.id ? (
              <div style={styles.editRow}>
                <input style={styles.smallInput} value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
                <select style={styles.smallInput} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="cashier">Cajero</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>
                <input style={styles.smallInput} placeholder="Nuevo PIN" maxLength={4} value={editForm.pin_code} onChange={(e) => setEditForm({ ...editForm, pin_code: e.target.value })} />
                <input style={styles.smallInput} placeholder="Nueva contrasena" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                <button style={styles.saveBtn} onClick={handleUpdate}>Guardar</button>
                <button style={styles.cancelBtn} onClick={() => setEditing(null)}>X</button>
              </div>
            ) : (
              <>
                <div style={styles.rowInfo}>
                  <span style={styles.rowName}>{user.full_name}</span>
                  <span style={styles.rowMeta}>@{user.username} | {user.role}</span>
                </div>
                <div style={styles.rowActions}>
                  {!user.is_active && <span style={styles.inactiveTag}>INACTIVO</span>}
                  <button style={styles.editBtn} onClick={() => startEdit(user)}>Editar</button>
                  <button
                    style={user.is_active ? styles.deactivateBtn : styles.activateBtn}
                    onClick={() => toggleActive(user)}
                  >
                    {user.is_active ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" },
  addBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  formCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: { margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#0f172a" },
  formGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  input: {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    outline: "none",
    minWidth: 140,
  },
  formActions: { display: "flex", gap: 8 },
  list: { display: "flex", flexDirection: "column", gap: 4 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  editRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", width: "100%" },
  smallInput: {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 12,
    minWidth: 100,
  },
  rowInfo: { display: "flex", flexDirection: "column", gap: 2 },
  rowName: { fontSize: 14, fontWeight: 500, color: "#0f172a" },
  rowMeta: { fontSize: 11, color: "#94a3b8" },
  rowActions: { display: "flex", alignItems: "center", gap: 8 },
  inactiveTag: {
    fontSize: 10,
    fontWeight: 700,
    background: "#fef2f2",
    color: "#dc2626",
    padding: "1px 6px",
    borderRadius: 4,
  },
  editBtn: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    color: "#334155",
  },
  deactivateBtn: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #dc2626",
    background: "#fff",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: 12,
  },
  activateBtn: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #16a34a",
    background: "#fff",
    color: "#16a34a",
    cursor: "pointer",
    fontSize: 12,
  },
  cancelBtn: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    color: "#64748b",
  },
  saveBtn: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
};
