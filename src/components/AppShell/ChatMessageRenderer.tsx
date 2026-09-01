import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ExternalLink,
  ArrowUpRight,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ChatMessageRendererProps {
  content: string;
  role?: "user" | "assistant";
  onNavigate?: () => void;
}

export const ChatMessageRenderer: React.FC<ChatMessageRendererProps> = ({
  content,
  role = "assistant",
  onNavigate,
}) => {
  const navigate = useNavigate();

  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      let targetUrl = url;
      // Normalize internal links
      const prMatch = url.match(/^\/purchasing\/(\d+)$/);
      if (prMatch) {
        targetUrl = `/administration`;
      }
      navigate(targetUrl);
      if (onNavigate) {
        onNavigate();
      }
    }
  };

  // Helper to render inline markdown (bold, code, links)
  const renderInline = (text: string): React.ReactNode[] => {
    const tokens: React.ReactNode[] = [];
    const regex = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(text.slice(lastIndex, match.index));
      }

      if (match[1].startsWith("[") && match[2] && match[3]) {
        // Markdown link [Label](url)
        const label = match[2];
        const url = match[3];
        const isInternalPR =
          url.startsWith("/purchasing/requests/") ||
          url.startsWith("/purchasing/") ||
          url.startsWith("/administration") ||
          /^\/tasks\/\d+/.test(url);

        if (isInternalPR) {
          tokens.push(
            <button
              key={`link-${match.index}`}
              type="button"
              onClick={(e) => handleLinkClick(url, e)}
              className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 my-0.5 rounded-md font-medium text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors shadow-2xs cursor-pointer group"
            >
              <FileText className="w-3 h-3 text-blue-500 shrink-0" />
              <span>{label}</span>
              <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          );
        } else {
          tokens.push(
            <a
              key={`link-${match.index}`}
              href={url}
              onClick={(e) => handleLinkClick(url, e)}
              className="inline-flex items-center gap-0.5 font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <span>{label}</span>
              <ExternalLink className="w-3 h-3 inline-block shrink-0 opacity-70" />
            </a>
          );
        }
      } else if (match[4]) {
        // Inline code `code`
        tokens.push(
          <code
            key={`code-${match.index}`}
            className="px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/60 dark:border-zinc-700/60"
          >
            {match[4]}
          </code>
        );
      } else if (match[5]) {
        // Bold **text**
        tokens.push(
          <strong key={`bold-${match.index}`} className="font-semibold text-foreground">
            {match[5]}
          </strong>
        );
      } else if (match[6]) {
        // Italic *text*
        tokens.push(<em key={`italic-${match.index}`}>{match[6]}</em>);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push(text.slice(lastIndex));
    }

    return tokens;
  };

  // Block-level parser
  const parsedBlocks = useMemo(() => {
    if (!content) return [];

    const lines = content.split("\n");
    const blocks: Array<{
      type: "p" | "h2" | "h3" | "ul" | "ol" | "card" | "codeblock";
      content?: string;
      items?: string[];
      cardData?: { label: string; url: string; id?: string };
    }> = [];

    let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
    let inCodeBlock = false;
    let codeContent = "";

    const flushList = () => {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Code blocks
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          blocks.push({ type: "codeblock", content: codeContent });
          codeContent = "";
          inCodeBlock = false;
        } else {
          flushList();
          inCodeBlock = true;
          codeContent = "";
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent += (codeContent ? "\n" : "") + line;
        continue;
      }

      // Standalone Request Action Link Line: e.g. [View Request](/purchasing/39) or [View Request #39](/purchasing/requests/39)
      const standaloneLinkMatch = trimmed.match(/^\[([^\]]+)\]\((\/[^)]+)\)$/);
      if (standaloneLinkMatch) {
        flushList();
        const label = standaloneLinkMatch[1];
        const url = standaloneLinkMatch[2];
        const idMatch = url.match(/\/(\d+)$/);
        blocks.push({
          type: "card",
          cardData: {
            label,
            url,
            id: idMatch ? idMatch[1] : undefined,
          },
        });
        continue;
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        flushList();
        blocks.push({ type: "h3", content: trimmed.slice(4) });
        continue;
      }
      if (trimmed.startsWith("## ")) {
        flushList();
        blocks.push({ type: "h2", content: trimmed.slice(3) });
        continue;
      }

      // Unordered list items
      if (/^[-*•]\s+/.test(trimmed)) {
        const itemText = trimmed.replace(/^[-*•]\s+/, "");
        if (!currentList || currentList.type !== "ul") {
          flushList();
          currentList = { type: "ul", items: [] };
        }
        currentList.items.push(itemText);
        continue;
      }

      // Ordered list items
      if (/^\d+\.\s+/.test(trimmed)) {
        const itemText = trimmed.replace(/^\d+\.\s+/, "");
        if (!currentList || currentList.type !== "ol") {
          flushList();
          currentList = { type: "ol", items: [] };
        }
        currentList.items.push(itemText);
        continue;
      }

      // Empty line
      if (!trimmed) {
        flushList();
        continue;
      }

      // Regular Paragraph
      flushList();
      blocks.push({ type: "p", content: line });
    }

    flushList();
    if (inCodeBlock) {
      blocks.push({ type: "codeblock", content: codeContent });
    }

    return blocks;
  }, [content]);

  if (role === "user") {
    return <div className="whitespace-pre-wrap leading-relaxed">{content}</div>;
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-800 dark:text-zinc-200">
      {parsedBlocks.map((block, idx) => {
        if (block.type === "h2") {
          return (
            <h4
              key={idx}
              className="font-semibold text-base text-foreground pt-1 pb-0.5 border-b border-border/40"
            >
              {renderInline(block.content || "")}
            </h4>
          );
        }

        if (block.type === "h3") {
          return (
            <h5 key={idx} className="font-semibold text-sm text-foreground pt-0.5">
              {renderInline(block.content || "")}
            </h5>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={idx} className="space-y-1.5 my-1 pl-1 list-none">
              {block.items?.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-xs sm:text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 mt-2 shrink-0" />
                  <span className="flex-1">{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={idx} className="space-y-1.5 my-1 pl-1 list-none">
              {block.items?.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-xs sm:text-sm">
                  <span className="font-semibold text-xs text-blue-600 dark:text-blue-400 shrink-0 w-4">
                    {itemIdx + 1}.
                  </span>
                  <span className="flex-1">{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "codeblock") {
          return (
            <div
              key={idx}
              className="my-2 p-3 rounded-lg bg-slate-950 text-slate-50 font-mono text-xs overflow-x-auto border border-slate-800"
            >
              <pre className="m-0">{block.content}</pre>
            </div>
          );
        }

        if (block.type === "card" && block.cardData) {
          const { label, url, id } = block.cardData;
          return (
            <div
              key={idx}
              className="my-2.5 p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/80 via-indigo-50/30 to-background dark:from-blue-950/40 dark:via-zinc-900/60 dark:to-zinc-900 shadow-2xs hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-600 text-white shadow-2xs shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs sm:text-sm text-foreground">
                        {id ? `Purchase Request #${id}` : label}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[10px] py-0 px-1.5 h-4.5"
                      >
                        Draft
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Click below to view details, add line items, or submit for approval.
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={(e) => handleLinkClick(url, e)}
                  className="h-8 px-3 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-2xs gap-1.5 shrink-0 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                >
                  <span>Open Request</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                </Button>
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="my-1">
            {renderInline(block.content || "")}
          </p>
        );
      })}
    </div>
  );
};
