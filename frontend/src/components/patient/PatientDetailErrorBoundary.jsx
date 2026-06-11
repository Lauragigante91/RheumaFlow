import React from "react";

export default class PatientDetailErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[PatientDetail] Render crash:", error, info?.componentStack);
    this.setState({ componentStack: info?.componentStack });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-900 space-y-2">
            <p className="font-bold text-base">Errore di visualizzazione</p>
            <p className="text-sm text-red-700">{String(this.state.error?.message || this.state.error)}</p>
            {process.env.NODE_ENV === "development" && this.state.componentStack && (
              <pre className="mt-2 text-[10px] font-mono bg-white border border-red-100 rounded p-2 overflow-auto max-h-64 text-red-800 whitespace-pre-wrap">
                {this.state.componentStack}
              </pre>
            )}
            <button
              className="mt-1 text-xs underline text-red-700 hover:text-red-900"
              onClick={() => this.setState({ error: null, componentStack: null })}
            >
              Riprova
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
