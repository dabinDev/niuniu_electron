import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

type MarkdownContentProps = {
  className?: string;
  value: string;
};

marked.setOptions({
  breaks: true,
  gfm: true
});

export function MarkdownContent({ className = "markdown-answer", value }: MarkdownContentProps) {
  const html = useMemo(() => {
    const sanitized = DOMPurify.sanitize(marked.parse(value, { async: false }));
    return sanitized.replace(/<table>/g, '<div class="history-markdown-table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  }, [value]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
