import Button from "@ds/primitives/Button";

export function GmailConnect({ onConnect }: { onConnect: () => Promise<void> }): JSX.Element {
  return <Button onClick={() => void onConnect()}>Connect Gmail</Button>;
}

export default GmailConnect;

