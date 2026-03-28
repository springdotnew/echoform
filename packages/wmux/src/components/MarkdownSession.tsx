import type { ReactElement } from "react";
import { WmuxMarkdown } from "../views";

export function MarkdownSession({ id, name, content }: {
  readonly id: string;
  readonly name: string;
  readonly content: string;
}): ReactElement {
  return <WmuxMarkdown id={id} name={name} content={content} />;
}
