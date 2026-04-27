import Button from "@ds/primitives/Button";

export function ReviewPanel({
  onRate,
}: {
  onRate: (rating: number) => void;
}): JSX.Element {
  return (
    <section style={{ display: "flex", gap: "0.75rem" }}>
      <Button onClick={() => onRate(2)}>Again</Button>
      <Button onClick={() => onRate(4)}>Good</Button>
    </section>
  );
}

export default ReviewPanel;
