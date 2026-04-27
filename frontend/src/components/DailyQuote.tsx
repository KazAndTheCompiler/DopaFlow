interface DailyQuoteProps {
  quote: string;
}

export default function DailyQuote({ quote }: DailyQuoteProps): JSX.Element {
  return (
    <div
      style={{
        fontStyle: "italic",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: "var(--text-sm)",
      }}
    >
      {quote}
    </div>
  );
}
