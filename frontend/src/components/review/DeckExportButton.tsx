interface DeckExportButtonProps { deckId: string }

export default function DeckExportButton({ deckId }: DeckExportButtonProps): JSX.Element {
  return <a href={`/api/v2/review/decks/${deckId}/export`} download style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Export ↓</a>;
}
