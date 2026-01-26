'use client';

import { useEffect, useState } from 'react';

export function useSelectedText() {
  const [selectedText, setSelectedText] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || null;
      setSelectedText(text);
    };

    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  return selectedText;
}
