'use client';

import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';

type Props = {
  chart: string;
};

let mermaidInitialized = false;

export function MarkdownMermaid({ chart }: Props) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const chartId = useMemo(
    () => `mermaid-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'dark',
          });
          mermaidInitialized = true;
        }

        const result = await mermaid.render(chartId, chart.trim());
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (renderError) {
        if (!cancelled) {
          setSvg('');
          setError(renderError instanceof Error ? renderError.message : 'Failed to render mermaid diagram');
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [chart, chartId]);

  if (error) {
    return (
      <div className="mermaid-block">
        <p className="mb-2 text-xs text-muted-foreground">Mermaid render error: {error}</p>
        <pre>
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      className="mermaid-block"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
