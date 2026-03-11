import { useState, useEffect } from "react";
import {
  getTickets, createTicket, updateTicket, deleteTicket, getTicketEmployees,
  type TicketData,
} from "@/services/api";
import type { User } from "@/types";
import toast from "react-hot-toast";

const STATUSES = [
  { key: "nuevo", label: "Nuevo", color: "#3b82f6" },
  { key: "en_progreso", label: "En Progreso", color: "#f59e0b" },
  { key: "completado", label: "Completado", color: "#16a34a" },
  { key: "cerrado", label: "Cerrado", color: "#64748b" },
];

const PRIORITIES: { key: string; label: string; color: string; bg: string }[] = [
  { key: "baja", label: "Baja", color: "#64748b", bg: "#f1f5f9" },
  { key: "normal", label: "Normal", color: "#2563eb", bg: "#eff6ff" },
  { key: "alta", label: "Alta", color: "#ea580c", bg: "#fff7ed" },
  { key: "urgente", label: "Urgente", color: "#dc2626", bg: "#fef2f2" },
];

function getPriorityStyle(p: string) {
  const found = PRIORITIES.find((x) => x.key === p);
  return found ? { color: found.color, background: found.bg } : {};
}

function fmtDate(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

interface Props {
  user: User;
}

export default function TicketBoard({ user }: Props) {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTicket, setEditTicket] = useState<TicketData | null>(null);
  const [filterAssigned, setFilterAssigned] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTickets();
    getTicketEmployees().then(setEmployees).catch(() => {});
  }, []);

  async function loadTickets() {
    try {
      const t = await getTickets();
      setTickets(t);
    } catch { /* ignore */ }
  }

  function openCreate() {
    setEditTicket(null);
    setTitle("");
    setDescription("");
    setPriority("normal");
    setAssignedTo("");
    setDueDate("");
    setShowForm(true);
  }

  function openEdit(t: TicketData) {
    setEditTicket(t);
    setTitle(t.title);
    setDescription(t.description);
    setPriority(t.priority);
    setAssignedTo(t.assigned_to || "");
    setDueDate(t.due_date || "");
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error("Escribe un titulo"); return; }
    setSaving(true);
    try {
      if (editTicket) {
        await updateTicket(editTicket.id, {
          title: title.trim(),
          description: description.trim(),
          priority,
          assigned_to: assignedTo || null,
          due_date: dueDate || null,
        });
        toast.success("Ticket actualizado");
      } else {
        await createTicket({
          title: title.trim(),
          description: description.trim(),
          priority,
          assigned_to: assignedTo || undefined,
          due_date: dueDate || undefined,
        });
        toast.success("Ticket creado");
      }
      setShowForm(false);
      loadTickets();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(ticketId: string, newStatus: string) {
    try {
      await updateTicket(ticketId, { status: newStatus });
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: newStatus } : t));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete(ticketId: string) {
    try {
      await deleteTicket(ticketId);
      toast.success("Ticket eliminado");
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      if (editTicket?.id === ticketId) setShowForm(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const filtered = tickets.filter((t) => {
    if (filterAssigned && t.assigned_to !== filterAssigned) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const isAdmin = user.role === "admin" || user.role === "manager";

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>Tickets</h2>
        <div style={s.filters}>
          <select style={s.filterSelect} value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}>
            <option value="">Todos</option>
            <option value={user.id}>Mis tickets</option>
            {employees.filter((e) => e.id !== user.id).map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
          <select style={s.filterSelect} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">Prioridad</option>
            {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button style={s.addBtn} onClick={openCreate}>+ Nuevo Ticket</button>
        </div>
      </div>

      {/* Board columns */}
      <div style={s.board}>
        {STATUSES.map((col) => {
          const colTickets = filtered.filter((t) => t.status === col.key);
          return (
            <div key={col.key} style={s.column}>
              <div style={{ ...s.colHeader, borderTopColor: col.color }}>
                <span style={s.colTitle}>{col.label}</span>
                <span style={s.colCount}>{colTickets.length}</span>
              </div>
              <div style={s.colBody}>
                {colTickets.map((t) => (
                  <div key={t.id} style={s.card} onClick={() => openEdit(t)}>
                    <div style={s.cardTop}>
                      <span style={{ ...s.priorityBadge, ...getPriorityStyle(t.priority) }}>
                        {PRIORITIES.find((p) => p.key === t.priority)?.label || t.priority}
                      </span>
                      {t.due_date && (
                        <span style={{
                          ...s.dueBadge,
                          color: new Date(t.due_date) < new Date() && t.status !== "completado" && t.status !== "cerrado" ? "#dc2626" : "#64748b",
                        }}>
                          {fmtDate(t.due_date)}
                        </span>
                      )}
                    </div>
                    <div style={s.cardTitle}>{t.title}</div>
                    {t.description && <div style={s.cardDesc}>{t.description}</div>}
                    <div style={s.cardFooter}>
                      {t.assigned_to_name ? (
                        <span style={s.assignee}>{t.assigned_to_name}</span>
                      ) : (
                        <span style={s.unassigned}>Sin asignar</span>
                      )}
                      <span style={s.ago}>{timeAgo(t.created_at)}</span>
                    </div>
                  </div>
                ))}
                {colTickets.length === 0 && (
                  <div style={s.emptyCol}>Sin tickets</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <div style={s.overlay} onClick={() => setShowForm(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>{editTicket ? "Editar Ticket" : "Nuevo Ticket"}</h3>

            <label style={s.label}>Titulo</label>
            <input style={s.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Que hay que hacer?" autoFocus />

            <label style={s.label}>Descripcion</label>
            <textarea style={s.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles (opcional)" rows={3} />

            <div style={s.formRow}>
              <div style={s.formCol}>
                <label style={s.label}>Prioridad</label>
                <select style={s.input} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div style={s.formCol}>
                <label style={s.label}>Fecha limite</label>
                <input type="date" style={s.input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <label style={s.label}>Asignar a</label>
            <select style={s.input} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Sin asignar</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.role})</option>)}
            </select>

            {editTicket && (
              <>
                <label style={s.label}>Estado</label>
                <div style={s.statusRow}>
                  {STATUSES.map((st) => (
                    <button
                      key={st.key}
                      style={editTicket.status === st.key ? { ...s.statusBtn, background: st.color, color: "#fff" } : s.statusBtn}
                      onClick={() => {
                        handleStatusChange(editTicket.id, st.key);
                        setEditTicket({ ...editTicket, status: st.key });
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div style={s.metaInfo}>
                  <span>Creado por: {editTicket.created_by_name}</span>
                  <span>Creado: {fmtDate(editTicket.created_at)}</span>
                </div>
              </>
            )}

            <div style={s.modalActions}>
              {editTicket && (isAdmin || editTicket.created_by === user.id) && (
                <button style={s.deleteBtn} onClick={() => handleDelete(editTicket.id)}>Eliminar</button>
              )}
              <div style={{ flex: 1 }} />
              <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={s.saveBtn} onClick={handleSubmit} disabled={saving}>
                {saving ? "Guardando..." : editTicket ? "Guardar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: "0 12px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", flexShrink: 0, flexWrap: "wrap", gap: 8 },
  title: { fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 },
  filters: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  filterSelect: { padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, background: "#fff" },
  addBtn: {
    padding: "8px 16px", borderRadius: 8, border: "none",
    background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
  },

  // Board
  board: { display: "flex", gap: 12, flex: 1, overflow: "auto", paddingBottom: 12 },
  column: {
    flex: 1, minWidth: 220, maxWidth: 320,
    display: "flex", flexDirection: "column", background: "#f8fafc", borderRadius: 10,
    border: "1px solid #e2e8f0", overflow: "hidden",
  },
  colHeader: {
    padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
    borderTop: "3px solid", background: "#fff",
  },
  colTitle: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  colCount: { fontSize: 11, fontWeight: 600, color: "#94a3b8", background: "#f1f5f9", padding: "2px 8px", borderRadius: 10 },
  colBody: { flex: 1, overflow: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: 8 },

  // Card
  card: {
    background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0",
    padding: "10px 12px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6,
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  priorityBadge: { fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 },
  dueBadge: { fontSize: 10, fontWeight: 600 },
  cardTitle: { fontSize: 13, fontWeight: 600, color: "#0f172a", lineHeight: 1.3 },
  cardDesc: {
    fontSize: 11, color: "#64748b", lineHeight: 1.3,
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
  },
  cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" },
  assignee: { fontSize: 10, fontWeight: 600, color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: 4 },
  unassigned: { fontSize: 10, color: "#cbd5e1" },
  ago: { fontSize: 10, color: "#94a3b8" },
  emptyCol: { textAlign: "center", color: "#cbd5e1", fontSize: 12, padding: 20 },

  // Modal
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000,
  },
  modal: {
    background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480,
    maxHeight: "90vh", overflow: "auto", display: "flex", flexDirection: "column", gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 },
  label: { fontSize: 12, fontWeight: 600, color: "#334155", margin: 0 },
  input: {
    padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
  },
  textarea: {
    padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical",
    fontFamily: "inherit",
  },
  formRow: { display: "flex", gap: 12 },
  formCol: { flex: 1, display: "flex", flexDirection: "column", gap: 6 },
  statusRow: { display: "flex", gap: 6 },
  statusBtn: {
    flex: 1, padding: "8px 4px", borderRadius: 6, border: "1px solid #e2e8f0",
    background: "#f8fafc", color: "#334155", cursor: "pointer", fontSize: 11, fontWeight: 600, textAlign: "center",
  },
  metaInfo: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", padding: "4px 0" },
  modalActions: { display: "flex", gap: 8, marginTop: 8 },
  deleteBtn: {
    padding: "10px 16px", borderRadius: 8, border: "1px solid #dc2626",
    background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  cancelBtn: {
    padding: "10px 16px", borderRadius: 8, border: "1px solid #e2e8f0",
    background: "#fff", color: "#334155", cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  saveBtn: {
    padding: "10px 20px", borderRadius: 8, border: "none",
    background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700,
  },
};
