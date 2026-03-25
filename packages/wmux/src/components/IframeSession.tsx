import type { ReactElement } from "react";
import { WmuxIframe } from "../views";

export function IframeSession({ id, name, url }: {
  readonly id: string;
  readonly name: string;
  readonly url: string;
}): ReactElement {
  return <WmuxIframe id={id} name={name} url={url} />;
}
