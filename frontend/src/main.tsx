import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Global reset + force light mode
const style = document.createElement("style");
style.textContent = `
  :root { color-scheme: light only !important; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  button { font-family: inherit; }
  input { font-family: inherit; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
  @media print {
    header, .no-print { display: none !important; }
  }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
