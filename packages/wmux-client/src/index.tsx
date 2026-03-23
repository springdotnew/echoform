import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@playfast/echoform/client";
import { parseHashParams } from "./utils/params";
import { useAuthenticatedTransport } from "./utils/transport";
import { WmuxApp } from "./components/WmuxApp";
import { WmuxTerminal } from "./components/WmuxTerminal";
import { THEME } from "./styles/theme";

const viewComponents = {
  WmuxApp,
  WmuxTerminal,
};

function ErrorPage({ message }: { readonly message: string }): React.ReactElement {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", width: "100vw",
      background: THEME.bg, color: THEME.error,
      fontFamily: THEME.fontFamily, fontSize: 14,
      padding: 40, textAlign: "center",
    }}>
      {message}
    </div>
  );
}

function LoadingPage(): React.ReactElement {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", width: "100vw",
      background: THEME.bg, color: THEME.textMuted,
      fontFamily: THEME.fontFamily, fontSize: 14,
    }}>
      Connecting...
    </div>
  );
}

function App(): React.ReactElement {
  const params = parseHashParams();

  if (!params) {
    return <ErrorPage message="Missing connection parameters. Use a wmux server URL to connect." />;
  }

  const { transport, error } = useAuthenticatedTransport(params.wsUrl, params.token);

  if (error) return <ErrorPage message={`Connection failed: ${error}`} />;
  if (!transport) return <LoadingPage />;

  return <Client transport={transport} views={viewComponents as any} requestViewTreeOnMount />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
