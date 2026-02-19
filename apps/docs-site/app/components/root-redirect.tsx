'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { type RouteLanguage } from '../../lib/languages';

function resolveAvailableLanguage(
  availableLanguages: RouteLanguage[],
  preferred: RouteLanguage = 'en',
): RouteLanguage {
  if (availableLanguages.includes(preferred)) {
    return preferred;
  }

  if (availableLanguages.includes('en')) {
    return 'en';
  }

  return availableLanguages[0] || 'en';
}

function preferredLanguage(availableLanguages: RouteLanguage[]): RouteLanguage {
  const candidates = [...(navigator.languages || []), navigator.language || ''];
  for (const lang of candidates) {
    const normalized = lang.toLowerCase();
    if (normalized.startsWith('ko') && availableLanguages.includes('ko')) {
      return 'ko';
    }
    if (normalized.startsWith('ja') && availableLanguages.includes('ja')) {
      return 'ja';
    }
    if (normalized.startsWith('es') && availableLanguages.includes('es')) {
      return 'es';
    }
  }
  return resolveAvailableLanguage(availableLanguages, 'en');
}

export function RootRedirect({ availableLanguages }: { availableLanguages: RouteLanguage[] }) {
  const router = useRouter();

  useEffect(() => {
    const normalizedAvailable =
      availableLanguages.length > 0 ? availableLanguages : (['en'] as RouteLanguage[]);
    const lang = preferredLanguage(normalizedAvailable);
    router.replace(lang === 'en' ? '/docs/home' : `/docs/${lang}/home`);
  }, [availableLanguages, router]);

  return (
    <main className="container-docs">
      <section className="panel">
        <div className="panel-body space-y-2">
          <h1 className="title">Opening Home…</h1>
          <p className="subtitle">Selecting your language from browser settings (fallback: English).</p>
        </div>
      </section>
    </main>
  );
}
