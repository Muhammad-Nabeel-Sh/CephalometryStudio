import { Component } from "react";
import { logError } from "../lib/logger.js";

const STORAGE_KEY = "cephalometry_projects";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logError("[ErrorBoundary]", error, info);
  }

  downloadBackup = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        alert("No local backup found.");
        return;
      }
      const blob = new Blob([raw], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Cephalometry Studio_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch {
      alert("Failed to export backup.");
    }
  };

  clearAndReload = () => {
    if (
      !window.confirm(
        "Clear ALL local data and reload?\nThis permanently deletes every project stored in this browser. Only do this if the app won't start. Your downloaded backup can be re-imported later.",
      )
    )
      return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* best-effort */
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const t = this.props.t || {
        bg: "#1a1a2e",
        tx: "#eee",
        tx2: "#888",
        acc: "#7c5cfc",
        err: "#f44",
        warn: "#fb0",
        bdr: "#333",
        surf: "#222",
        surf2: "#2a2a3e",
      };
      const errMsg = this.state.error?.message || String(this.state.error);
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: t.bg,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>&#x2699;</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: t.tx,
              marginBottom: 8,
            }}
          >
            Something went wrong
          </div>
          <div
            style={{
              fontSize: 13,
              color: t.tx2,
              maxWidth: 400,
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            An unexpected error occurred. Your data is safe &mdash; projects are
            saved automatically.
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: t.acc,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload App
            </button>
            <button
              onClick={this.downloadBackup}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: `1px solid ${t.bdr}`,
                background: t.surf2 || t.surf,
                color: t.tx,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Download Backup
            </button>
          </div>
          <button
            onClick={this.clearAndReload}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: t.err || "#f44",
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Clear Data &amp; Reload
          </button>
          <button
            onClick={() =>
              this.setState((s) => ({ showDetails: !s.showDetails }))
            }
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: t.tx2 || "#888",
              fontSize: 10,
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            {this.state.showDetails ? "Hide details" : "Show error details"}
          </button>
          {this.state.showDetails && (
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 6,
                background: t.surf2 || t.surf,
                color: t.tx2 || "#888",
                fontSize: 10,
                fontFamily: "'DM Mono',monospace",
                maxWidth: 600,
                overflowX: "auto",
                textAlign: "left",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {errMsg}
              {"\n\n"}
              {this.state.error?.stack || ""}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
