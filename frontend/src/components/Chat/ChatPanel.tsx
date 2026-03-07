import { useState, useRef, useEffect } from "react";
import { sendChatMessage } from "@/services/api";

interface Message {
  id: number;
  role: "user" | "bot";
  text: string;
  imageUrl?: string;
  action?: string | null;
  pending?: boolean;
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "bot", text: "Hola! Dime lo que necesites o manda una foto de un recibo.\n\nEjemplos:\n• *ponle 30 pesos al 7501234567890*\n• *foto de recibo + \"gasto de proveedores\"*\n• *buscar coca cola*\n\nEscribe **ayuda** para mas opciones." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingConfirm, setWaitingConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string, image?: File) {
    if (!text.trim() && !image) return;
    if (loading) return;

    // Show user message
    const userMsg: Message = {
      id: nextId.current++,
      role: "user",
      text: text.trim() || (image ? "Foto de recibo" : ""),
    };
    if (image) {
      userMsg.imageUrl = URL.createObjectURL(image);
    }
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendChatMessage(text.trim(), image);
      const botMsg: Message = {
        id: nextId.current++,
        role: "bot",
        text: res.reply,
        action: res.action,
        pending: res.pending,
      };
      setMessages((prev) => [...prev, botMsg]);
      setWaitingConfirm(!!res.pending);
    } catch (err: any) {
      setMessages((prev) => [...prev, { id: nextId.current++, role: "bot", text: `Error: ${err.message}` }]);
      setWaitingConfirm(false);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Send image with whatever text is in the input as context
    send(input || "", file);
  }

  function renderText(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\n)/g);
    return parts.map((part, i) => {
      if (part === "\n") return <br key={i} />;
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} style={st.code}>{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div style={st.container}>
      <div style={st.messages}>
        {messages.map((msg) => (
          <div key={msg.id} style={msg.role === "user" ? st.userBubble : st.botBubble}>
            {msg.action && (
              <span style={st.actionBadge}>{
                msg.action === "price_change" ? "Precio actualizado" :
                msg.action === "cost_change" ? "Costo actualizado" :
                msg.action === "stock_change" ? "Stock actualizado" :
                msg.action === "expense_added" ? "Gasto registrado" :
                msg.action === "income_added" ? "Ingreso registrado" :
                msg.action === "category_change" ? "Categoria cambiada" :
                msg.action === "search" ? "Resultado" :
                msg.action
              }</span>
            )}
            {msg.imageUrl && (
              <img src={msg.imageUrl} style={st.chatImage} alt="Recibo" />
            )}
            <div style={st.msgText}>{renderText(msg.text)}</div>
          </div>
        ))}
        {loading && (
          <div style={st.botBubble}>
            <div style={st.msgText}>Procesando...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick confirm/cancel buttons when pending */}
      {waitingConfirm && !loading && (
        <div style={st.confirmBar}>
          <button style={st.confirmBtn} onClick={() => send("si")}>Si, confirmar</button>
          <button style={st.cancelBtnBar} onClick={() => send("no")}>Cancelar</button>
        </div>
      )}

      <div style={st.inputBar}>
        <button style={st.photoBtn} onClick={() => fileRef.current?.click()} title="Enviar foto de recibo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleImageSelect}
        />
        <input
          ref={inputRef}
          style={st.input}
          placeholder="Escribe o manda foto de recibo..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button style={st.sendBtn} onClick={() => send(input)} disabled={loading || !input.trim()}>
          Enviar
        </button>
      </div>
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    maxWidth: 700,
    margin: "0 auto",
    padding: "0 8px",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 0",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    background: "#2563eb",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "14px 14px 4px 14px",
    maxWidth: "80%",
    fontSize: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  botBubble: {
    alignSelf: "flex-start",
    background: "#f1f5f9",
    color: "#0f172a",
    padding: "10px 14px",
    borderRadius: "14px 14px 14px 4px",
    maxWidth: "85%",
    fontSize: 14,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  msgText: { lineHeight: 1.5, wordBreak: "break-word" },
  chatImage: {
    maxWidth: 200,
    maxHeight: 150,
    borderRadius: 8,
    objectFit: "cover",
  },
  actionBadge: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#dcfce7",
    color: "#16a34a",
    padding: "2px 8px",
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  code: {
    background: "#e2e8f0",
    padding: "1px 5px",
    borderRadius: 4,
    fontSize: 13,
    fontFamily: "monospace",
  },
  confirmBar: {
    display: "flex",
    gap: 8,
    padding: "8px 0",
    justifyContent: "center",
  },
  confirmBtn: {
    padding: "10px 24px",
    borderRadius: 10,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  cancelBtnBar: {
    padding: "10px 24px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  inputBar: {
    display: "flex",
    gap: 8,
    padding: "12px 0",
    borderTop: "1px solid #e2e8f0",
    flexShrink: 0,
    alignItems: "center",
  },
  photoBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#64748b",
    cursor: "pointer",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 15,
    outline: "none",
  },
  sendBtn: {
    padding: "12px 20px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
