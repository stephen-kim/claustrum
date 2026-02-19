import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DocsSidebar } from '../../components/docs-sidebar';
import { MarkdownDocContent } from '../../components/markdown-doc-content';
import { buildDocHref, getDocBySegments, getDocParams, getRouteLanguageFromSegments } from '../../../lib/docs';

type Props = {
  params: { slug: string[] };
};

export function generateStaticParams() {
  return getDocParams();
}

export function generateMetadata({ params }: Props): Metadata {
  const doc = getDocBySegments(params.slug);
  if (!doc) {
    return { title: 'Document Not Found | Claustrum Docs' };
  }
  return {
    title: `${doc.title} | Claustrum Docs`,
    description: `Documentation page: ${doc.title}`,
  };
}

export default function DocPage({ params }: Props) {
  const doc = getDocBySegments(params.slug);
  const requestedLang = getRouteLanguageFromSegments(params.slug || []);
  if (!doc) {
    notFound();
  }
  const currentHref = buildDocHref(doc.slugBase, requestedLang);
  const homeHref = requestedLang === 'en' ? '/docs/home' : `/docs/${requestedLang}/home`;

  return (
    <main className="container-docs grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <DocsSidebar lang={requestedLang} currentHref={currentHref} />

      <section className="panel">
        <div className="panel-body space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="subtitle">
                {requestedLang !== 'en' && doc.lang === 'en'
                  ? `${requestedLang.toUpperCase()} fallback to English document`
                  : doc.lang === 'ko'
                    ? 'Korean document'
                    : 'English document'}{' '}
                · Source: {doc.fileName}
              </p>
            </div>
            <div className="flex gap-2">
              <Link className="button-link no-underline" href={homeHref}>
                Home
              </Link>
            </div>
          </div>

          <article className="prose-docs">
            <MarkdownDocContent body={doc.body} />
          </article>
          <p className="subtitle">Last updated: {doc.lastUpdated}</p>
        </div>
      </section>
    </main>
  );
}
