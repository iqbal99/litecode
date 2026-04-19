import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import "./monacoWorkers";
import { store } from "./store/store";
import App from "./App";

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("LiteCode root error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: 24,
            color: "#ddd",
            background: "#1e1e1e",
            height: "100vh",
            boxSizing: "border-box",
            overflow: "auto",
          }}
        >
          <h1 style={{ fontSize: 18, marginTop: 0 }}>LiteCode failed to start</h1>
          <p>Please restart the app. If the problem persists, include the message below when reporting the issue.</p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#111",
              padding: 12,
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            {String(this.state.error.stack ?? this.state.error.message)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("LiteCode: could not find #root element in index.html");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </RootErrorBoundary>
  </React.StrictMode>,
);
