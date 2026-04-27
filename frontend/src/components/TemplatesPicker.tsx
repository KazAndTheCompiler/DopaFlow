import { useEffect, useState } from "react";
import Button from "@ds/primitives/Button";
import { useAppJournal } from "../app/AppContexts";

interface Template {
  id: string;
  name: string;
}
interface TemplatesPickerProps {
  onApply: (body: string, tags: string[]) => void;
}

export function TemplatesPicker({
  onApply,
}: TemplatesPickerProps): JSX.Element {
  const journal = useAppJournal();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setTemplates(journal.templates);
  }, [journal.templates]);
  return (
    <div style={{ position: "relative", width: "fit-content" }}>
      <Button
        onClick={() => setOpen((value) => !value)}
        variant="secondary"
        style={{ padding: "0.45rem 0.8rem", borderRadius: 10 }}
      >
        Templates ▾
      </Button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 0.35rem)",
            left: 0,
            zIndex: 20,
            display: "grid",
            gap: "0.25rem",
            padding: "0.5rem",
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
          }}
        >
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                void journal
                  .applyTemplate(template.id)
                  .then((body) => onApply(body.body, body.tags));
                setOpen(false);
              }}
              style={{
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                color: "var(--text)",
                fontSize: "var(--text-sm)",
              }}
            >
              {template.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TemplatesPicker;
