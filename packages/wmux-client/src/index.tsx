import "./index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@playfast/echoform/client";
import { parseHashParams } from "./utils/params";
import { useAuthenticatedTransport } from "./utils/transport";
import { WmuxApp } from "./components/WmuxApp";
import { WmuxTerminal } from "./components/WmuxTerminal";
import { FileViewer as WmuxFileViewer } from "./components/FileViewer";

const viewComponents = {
  WmuxApp,
  WmuxTerminal,
  WmuxFileViewer,
};

function ErrorPage({ message }: { readonly message: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background text-destructive font-sans text-sm p-10 text-center">
      {message}
    </div>
  );
}

function LoadingPage(): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background text-muted-foreground font-sans text-sm">
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

  return <Client transport={transport} views={viewComponents} requestViewTreeOnMount />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
