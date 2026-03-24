import type { ReactElement, ReactNode } from "react";

interface WmuxIframeProps {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly children?: ReactNode;
}

export function WmuxIframe({ name, url }: WmuxIframeProps): ReactElement {
  return (
    <iframe
      src={url}
      title={name}
      className="w-full h-full border-none bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
