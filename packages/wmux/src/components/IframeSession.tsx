import type { ReactElement } from "react";
import { useViews } from "@playfast/echoform/server";
import { views } from "../views";

export function IframeSession({ id, name, url }: {
  readonly id: string;
  readonly name: string;
  readonly url: string;
}): ReactElement {
  const View = useViews(views);
  return <View.WmuxIframe id={id} name={name} url={url} />;
}
