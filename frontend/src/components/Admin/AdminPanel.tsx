import { useState } from "react";
import Dashboard from "@/components/Admin/Dashboard";
import Reports from "@/components/Admin/Reports";
import ProductManager from "@/components/Admin/ProductManager";
import SalesHistory from "@/components/Admin/SalesHistory";
import EmployeeManager from "@/components/Admin/EmployeeManager";
import InventoryManager from "@/components/Admin/InventoryManager";

type Tab = "dashboard" | "reports" | "products" | "sales" | "employees" | "inventory";

const tabs: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reports", label: "Reportes" },
  { key: "products", label: "Productos" },
  { key: "sales", label: "Ventas" },
  { key: "employees", label: "Empleados" },
  { key: "inventory", label: "Inventario" },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <div style={styles.container}>
      <div style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            style={activeTab === tab.key ? { ...styles.tab, ...styles.tabActive } : styles.tab}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.content}>
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "reports" && <Reports />}
        {activeTab === "products" && <ProductManager />}
        {activeTab === "sales" && <SalesHistory />}
        {activeTab === "employees" && <EmployeeManager />}
        {activeTab === "inventory" && <InventoryManager />}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#f8fafc",
  },
  tabBar: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid #e2e8f0",
    background: "#fff",
    padding: "0 16px",
    flexShrink: 0,
  },
  tab: {
    padding: "12px 20px",
    border: "none",
    borderBottom: "2px solid transparent",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  tabActive: {
    color: "#0f172a",
    borderBottomColor: "#2563eb",
    fontWeight: 600,
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: 16,
  },
};
