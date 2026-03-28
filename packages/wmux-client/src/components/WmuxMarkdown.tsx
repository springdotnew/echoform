import { useMemo, type ReactElement, type ReactNode } from "react";
import { marked } from "marked";

interface WmuxMarkdownProps {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly children?: ReactNode;
}

export function WmuxMarkdown({ content }: WmuxMarkdownProps): ReactElement {
  const html = useMemo(() => marked.parse(content, { async: false }) as string, [content]);

  return (
    <div className="w-full h-full overflow-auto">
      <div
        className="wmux-markdown max-w-3xl mx-auto px-8 py-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
