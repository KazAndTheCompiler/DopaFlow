/**
 * Lightweight renderer: bold, italic, headings, #tags, [[wikilinks]], and newlines.
 * No external markdown library needed — keeps bundle small.
 */

interface WikiRendererProps {
  body: string;
  onWikiClick: (date: string) => void;
}

function renderLine(
  line: string,
  onWikiClick: (date: string) => void,
  key: number,
): JSX.Element {
  // Headings
  if (/^#{1,3} /.test(line)) {
    const level = line.match(/^#+/)?.[0].length ?? 1;
    const text = line.replace(/^#+\s+/, "");
    const style: React.CSSProperties = {
      fontWeight: 700,
      fontSize: level === 1 ? "1.2em" : level === 2 ? "1.05em" : "1em",
      margin: "0.5rem 0 0.15rem",
      color: "var(--text)",
    };
    return (
      <div key={key} style={style}>
        {text}
      </div>
    );
  }

  // Horizontal rule
  if (/^---+$/.test(line.trim())) {
    return (
      <hr
        key={key}
        style={{
          border: "none",
          borderTop: "1px solid var(--border-subtle)",
          margin: "0.5rem 0",
        }}
      />
    );
  }

  // Parse inline tokens
  const tokens: JSX.Element[] = [];
  let remaining = line;
  let i = 0;

  while (remaining.length > 0) {
    // Wikilink [[date]]
    const wikiMatch = remaining.match(/^\[\[([^\]]+)\]\]/);
    if (wikiMatch) {
      const date = wikiMatch[1];
      tokens.push(
        <button
          key={`w-${i++}`}
          onClick={() => onWikiClick(date)}
          style={{
            background: "none",
            border: "none",
            padding: "0 2px",
            color: "var(--accent)",
            cursor: "pointer",
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: "2px",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          {date}
        </button>,
      );
      remaining = remaining.slice(wikiMatch[0].length);
      continue;
    }

    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      tokens.push(<strong key={`b-${i++}`}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic *text* or _text_
    const italicMatch = remaining.match(/^[*_]([^*_]+)[*_]/);
    if (italicMatch) {
      tokens.push(<em key={`e-${i++}`}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Inline code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(
        <code
          key={`c-${i++}`}
          style={{
            background: "var(--surface-2)",
            padding: "0 4px",
            borderRadius: "4px",
            fontSize: "0.9em",
          }}
        >
          {codeMatch[1]}
        </code>,
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Hashtag #word
    const tagMatch = remaining.match(/^(#\w+)/);
    if (tagMatch) {
      tokens.push(
        <span
          key={`t-${i++}`}
          style={{ color: "var(--accent)", fontWeight: 500 }}
        >
          {tagMatch[1]}
        </span>,
      );
      remaining = remaining.slice(tagMatch[0].length);
      continue;
    }

    // Consume one char
    const ch = remaining[0];
    if (
      tokens.length > 0 &&
      typeof (tokens[tokens.length - 1] as JSX.Element).type === "undefined"
    ) {
      // merge string nodes — not possible, just push char as span
    }
    tokens.push(<span key={`s-${i++}`}>{ch}</span>);
    remaining = remaining.slice(1);
  }

  return (
    <div
      key={key}
      style={{ minHeight: "1.4em", lineHeight: 1.65, color: "var(--text)" }}
    >
      {tokens}
    </div>
  );
}

export function WikiRenderer({
  body,
  onWikiClick,
}: WikiRendererProps): JSX.Element {
  if (!body.trim()) {
    return (
      <div
        style={{
          color: "var(--text-muted)",
          fontStyle: "italic",
          fontSize: "var(--text-sm)",
        }}
      >
        Nothing written yet.
      </div>
    );
  }

  const lines = body.split("\n");

  return (
    <div style={{ lineHeight: 1.65, fontSize: "var(--text-base)" }}>
      {lines.map((line, idx) => renderLine(line, onWikiClick, idx))}
    </div>
  );
}

export default WikiRenderer;
