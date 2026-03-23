import React from "react";
import { useViews } from "@playfast/echoform/server";
import { views } from "../views";

export function IframeSession({ id, name, url }: {
  readonly id: string;
  readonly name: string;
  readonly url: string;
}): React.ReactElement | null {
  const View = useViews(views);
  if (!View) return null;
  return <View.WmuxIframe id={id} name={name} url={url} />;
}
