import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@playfast/echoform/client";
import { useWebSocketTransport } from "@playfast/echoform-bun-ws-client";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import {
  DashboardApp,
  RuntimeStatus,
  WidgetGrid,
  WidgetFrame,
  PluginEditor,
  ErrorPanel,
  PluginRuntimeProvider,
} from "./components";
import "./styles.css";

declare global {
  interface Window {
    MonacoEnvironment?: {
      readonly getWorker: (_workerId: string, label: string) => Worker;
    };
  }
}

window.MonacoEnvironment = {
  getWorker: (_workerId: string, label: string) => {
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

const components = {
  DashboardApp,
  RuntimeStatus,
  WidgetGrid,
  WidgetFrame,
  PluginEditor,
  ErrorPanel,
};

const widgetPluginWsUrl = import.meta.env["VITE_WIDGET_PLUGIN_WS_URL"] ?? "ws://localhost:4241/ws";

function App(): React.ReactElement {
  const { transport, error } = useWebSocketTransport(widgetPluginWsUrl);

  if (error) {
    return <div className="connection-state">Connection error: {error}</div>;
  }

  if (!transport) {
    return <div className="connection-state">Connecting...</div>;
  }

  return (
    <PluginRuntimeProvider>
      <Client transport={transport} views={components} requestViewTreeOnMount />
    </PluginRuntimeProvider>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
