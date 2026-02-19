import type { Metadata } from 'next';
import Script from 'next/script';
import { DocsSidebar } from '../../components/docs-sidebar';

export const metadata: Metadata = {
  title: 'API Explorer | Claustrum Docs',
  description: 'Interactive OpenAPI explorer powered by Scalar.',
};

const scalarConfiguration = {
  theme: 'deepSpace',
  darkMode: true,
  hideClientButton: true,
  searchHotKey: 'k',
};

export default function ApiExplorerPage() {
  return (
    <main className="container-docs grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <DocsSidebar lang="en" currentHref="/docs/api-reference" />

      <section className="panel overflow-hidden">
        <div className="panel-body space-y-4 border-b border-border/70">
          <h1 className="title">API Explorer</h1>
          <p className="subtitle">
            Interactive OpenAPI documentation for Memory Core. Use this explorer instead of the old static endpoint list.
          </p>
        </div>

        <script id="api-reference" data-url="/openapi.json" data-configuration={JSON.stringify(scalarConfiguration)} />
        <Script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference" strategy="afterInteractive" />
      </section>
    </main>
  );
}
