import { useState, useTransition } from 'react';

export interface UseCommandBarResult {
  input: string;
  pending: boolean;
  setInput: (value: string) => void;
  submit: (handler: (value: string) => Promise<void>) => Promise<void>;
}

export function useCommandBar(): UseCommandBarResult {
  const [input, setInput] = useState<string>('');
  const [pending, startTransition] = useTransition();

  return {
    input,
    pending,
    setInput,
    submit: async (handler: (value: string) => Promise<void>) =>
      new Promise<void>((resolve) => {
        startTransition(() => {
          void handler(input).finally(() => resolve());
        });
      }),
  };
}
