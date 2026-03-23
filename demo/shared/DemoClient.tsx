import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@react-fullstack/fullstack/client";
import { useWebSocketTransport } from "@react-fullstack/fullstack-bun-ws-client";

interface DemoClientOptions {
  readonly wsUrl: string;
  readonly views: Record<string, React.ComponentType<any>>;
  readonly wrapper?: (children: React.ReactElement) => React.ReactElement;
}

function DemoClientApp({ wsUrl, views, wrapper }: DemoClientOptions): React.ReactElement {
  const { transport, error } = useWebSocketTransport(wsUrl);

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#ff4444" }}>
        Connection error: {error}
      </div>
    );
  }

  if (!transport) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        Connecting...
      </div>
    );
  }

  const client = <Client transport={transport} views={views} requestViewTreeOnMount />;
  return wrapper ? wrapper(client) : client;
}

export function mountDemoClient(options: DemoClientOptions): void {
  const container = document.getElementById("root");
  if (container) {
    const root = createRoot(container);
    root.render(<DemoClientApp {...options} />);
  }
}
