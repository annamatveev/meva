/**
 * Client-side Markdown block parser — a compact mirror of the server's
 * SemanticDiffService.parseBlocks + blockKey, kept consistent so the editor's
 * attribution gutter aligns with the server's attribution index.
 */

export type ClientBlockType = "heading" | "paragraph" | "listItem" | "code" | "quote";

export interface ClientBlock {
  blockType: ClientBlockType;
  depth?: number;
  text: string;
}

export function blockKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseBlocks(markdown: string): ClientBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ClientBlock[] = [];
  let i = 0;
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushP = () => {
    if (paragraph.length) {
      blocks.push({ blockType: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushQ = () => {
    if (quote.length) {
      blocks.push({ blockType: "quote", text: quote.join(" ").trim() });
      quote = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushP();
      flushQ();
      const fence: string[] = [line];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        fence.push(lines[i] ?? "");
        i++;
      }
      if (i < lines.length) fence.push(lines[i] ?? "");
      i++;
      blocks.push({ blockType: "code", text: fence.join("\n") });
      continue;
    }

    if (trimmed === "") {
      flushP();
      flushQ();
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushP();
      flushQ();
      blocks.push({ blockType: "heading", depth: heading[1]!.length, text: heading[2]!.trim() });
      i++;
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushP();
      flushQ();
      blocks.push({ blockType: "listItem", text: trimmed.replace(/^([-*+]|\d+\.)\s+/, "").trim() });
      i++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushP();
      quote.push(trimmed.replace(/^>\s?/, ""));
      i++;
      continue;
    }

    flushQ();
    paragraph.push(trimmed);
    i++;
  }

  flushP();
  flushQ();
  return blocks;
}
