/** @jsxImportSource @opentui/react */
import type { ReactNode } from "react";
import { SyntaxStyle } from "@opentui/core";
import { usePrefixContext } from "./FocusContext";

const syntaxStyle = SyntaxStyle.create();

interface WmuxMarkdownProps {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly children?: ReactNode;
}

export const WmuxMarkdown = ({ id, content }: WmuxMarkdownProps): ReactNode => {
  const { activeTabId } = usePrefixContext();
  if (activeTabId !== id) return null;

  return (
    <scrollbox flexGrow={1}>
      <markdown content={content} syntaxStyle={syntaxStyle} conceal />
    </scrollbox>
  );
};
