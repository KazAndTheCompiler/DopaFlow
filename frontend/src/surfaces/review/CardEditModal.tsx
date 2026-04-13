import { useEffect, useState } from 'react';

import Modal from '@ds/primitives/Modal';
import Button from '@ds/primitives/Button';
import type { ReviewCard } from '../../../../shared/types';

interface CardEditModalProps {
  card: ReviewCard | null;
  onClose: () => void;
  onSave: (id: string, front: string, back: string) => Promise<void>;
}

export function CardEditModal({ card, onClose, onSave }: CardEditModalProps): JSX.Element | null {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!card) {
      return;
    }
    setFront(card.front);
    setBack(card.back);
    setSaving(false);
  }, [card]);

  if (!card) {
    return null;
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.7rem 0.8rem',
    borderRadius: '12px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '88px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 700,
    marginBottom: '0.25rem',
    display: 'block',
  };

  const handleSave = async (): Promise<void> => {
    if (!front.trim() || saving) {
      return;
    }
    setSaving(true);
    try {
      await onSave(card.id, front.trim(), back.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Edit card" onClose={onClose}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: '12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-subtle)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          Editing card · deck {card.deck_id} · {card.reviews_done} review
          {card.reviews_done === 1 ? '' : 's'} done
        </div>

        <div>
          <label style={labelStyle}>Front</label>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            aria-label="Card front"
            style={inputStyle}
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>Back</label>
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            aria-label="Card back"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            variant="primary"
            disabled={saving || !front.trim()}
          >
            {saving ? 'Saving…' : 'Save card'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CardEditModal;
