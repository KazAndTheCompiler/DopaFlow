import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../api/client";

interface SearchResult { id: string; type: string; title: string; snippet: string; date?: string | null }
interface SearchBarProps { onResults: (results: SearchResult[]) => void }

export function SearchBar({ onResults }: SearchBarProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!query.trim()) return void (onResults([]), setCount(null));
      fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((body: { results: SearchResult[]; total: number }) => { onResults(body.results); setCount(body.total); })
        .catch(() => { onResults([]); setCount(0); });
    }, 300);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [onResults, query]);
  return <div style={{ display: "grid", gap: "0.35rem" }}><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search everything..." style={{ padding: "0.6rem 0.8rem", borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--surface-2)", color: "var(--text-primary)" }} />{count !== null ? <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{`${count} results for '${query}'`}</span> : null}</div>;
}

export default SearchBar;
