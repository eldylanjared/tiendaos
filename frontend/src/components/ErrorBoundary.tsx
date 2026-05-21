import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={styles.container}>
          <p style={styles.title}>Algo salió mal</p>
          <p style={styles.message}>{this.state.error?.message}</p>
          {this.state.componentStack && (
            <pre style={styles.stack}>{this.state.componentStack.slice(0, 800)}</pre>
          )}
          <button
            style={styles.btn}
            onClick={() => this.setState({ hasError: false, error: null, componentStack: null })}
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
  stack: { margin: 0, fontSize: 11, color: "#94a3b8", fontFamily: "monospace", whiteSpace: "pre-wrap", maxWidth: 600 },
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
