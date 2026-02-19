'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function MarkdownCodeBlock({ children }: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const [canCopy, setCanCopy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) {
      setCanCopy(false);
      return;
    }

    // Mermaid blocks are rendered as custom diagrams, not plain code snippets.
    const hasMermaidBlock = Boolean(pre.querySelector('.mermaid-block'));
    const hasCodeNode = Boolean(pre.querySelector('code'));
    setCanCopy(hasCodeNode && !hasMermaidBlock);
  }, [children]);

  async function handleCopy() {
    const pre = preRef.current;
    const codeNode = pre?.querySelector('code');
    const raw = codeNode?.textContent || '';
    const text = raw.trimEnd();
    if (!text) {
      return;
    }

    try {
      await copyToClipboard(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-block-wrapper">
      {canCopy ? (
        <button
          type="button"
          className="code-copy-btn"
          onClick={handleCopy}
          aria-label="Copy code block"
          title="Copy code"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      ) : null}
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}
