import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", background: "#f9fafb", padding: "32px",
        }}>
          <div style={{
            maxWidth: 480, width: "100%", background: "#fff",
            border: "1px solid #e5e7eb", borderRadius: "12px",
            padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "#fef2f2", display: "flex", alignItems: "center",
              justifyContent: "center", margin: "0 auto 16px",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0A2540", marginBottom: 8 }}>
              Si è verificato un errore
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
              Questa sezione ha riscontrato un problema imprevisto.
              Puoi riprovare o ricaricare la pagina.
            </p>
            {this.state.error?.message && (
              <pre style={{
                fontSize: 11, background: "#f9fafb", border: "1px solid #e5e7eb",
                borderRadius: 6, padding: "8px 12px", color: "#374151",
                textAlign: "left", marginBottom: 20, overflowX: "auto",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: "8px 18px", borderRadius: 8,
                  background: "#0A2540", color: "#fff", border: "none",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Riprova
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "8px 18px", borderRadius: 8,
                  background: "#f3f4f6", color: "#374151",
                  border: "1px solid #e5e7eb", fontSize: 13,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Ricarica pagina
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
