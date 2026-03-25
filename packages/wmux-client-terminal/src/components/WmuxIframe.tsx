import type { ReactNode } from "react";

interface WmuxIframeProps {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly children?: ReactNode;
}

export const WmuxIframe = ({ name, url }: WmuxIframeProps): ReactNode => (
  <box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column" gap={1}>
    <text fg="#98989d">
      <strong>{name}</strong>
    </text>
    <text fg="#0a84ff">
      <a href={url}>{url}</a>
    </text>
    <text fg="#636366">Open in browser to view</text>
  </box>
);
