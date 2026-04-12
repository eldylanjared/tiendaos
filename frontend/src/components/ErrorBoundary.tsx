import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={styles.container}>
          <p style={styles.title}>Algo salió mal</p>
          <p style={styles.message}>{this.state.error?.message}</p>
          <button
            style={styles.btn}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 32,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "flex-start",
  },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: "#ef4444" },
  message: { margin: 0, fontSize: 13, color: "#64748b", fontFamily: "monospace" },
  btn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
};
