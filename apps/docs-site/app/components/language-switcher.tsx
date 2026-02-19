'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTE_LANGUAGE_LABELS, SUPPORTED_ROUTE_LANGUAGES, type RouteLanguage } from '../../lib/languages';

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

function inferLanguageFromBrowser(availableLanguages: RouteLanguage[]): RouteLanguage {
  if (typeof navigator === 'undefined') {
    return resolveAvailableLanguage(availableLanguages, 'en');
  }

  const candidates = [...(navigator.languages || []), navigator.language || ''];
  for (const value of candidates) {
    const lang = value.toLowerCase();
    if (lang.startsWith('ko') && availableLanguages.includes('ko')) {
      return 'ko';
    }
    if (lang.startsWith('ja') && availableLanguages.includes('ja')) {
      return 'ja';
    }
    if (lang.startsWith('es') && availableLanguages.includes('es')) {
      return 'es';
    }
  }

  return resolveAvailableLanguage(availableLanguages, 'en');
}

function parsePath(pathname: string, availableLanguages: RouteLanguage[]): { currentLang: RouteLanguage; slug: string } {
  const idx = pathname.indexOf('/docs/');
  const docsPath = idx >= 0 ? pathname.slice(idx) : pathname;

  if (!docsPath.startsWith('/docs/')) {
    return { currentLang: inferLanguageFromBrowser(availableLanguages), slug: 'home' };
  }

  const rest = docsPath.slice('/docs/'.length).replace(/\/$/, '');
  if (!rest) {
    return { currentLang: inferLanguageFromBrowser(availableLanguages), slug: 'home' };
  }

  const [first, ...tail] = rest.split('/');
  if (SUPPORTED_ROUTE_LANGUAGES.includes(first as RouteLanguage) && first !== 'en') {
    return {
      currentLang: resolveAvailableLanguage(availableLanguages, first as RouteLanguage),
      slug: tail.join('/') || 'home',
    };
  }

  return { currentLang: resolveAvailableLanguage(availableLanguages, 'en'), slug: rest || 'home' };
}

function buildHref(lang: RouteLanguage, slug: string): string {
  const safeSlug = slug || 'home';
  return lang === 'en' ? `/docs/${safeSlug}` : `/docs/${lang}/${safeSlug}`;
}

export function LanguageSwitcher({ availableLanguages }: { availableLanguages: RouteLanguage[] }) {
  const router = useRouter();
  const pathname = usePathname();

  const normalizedAvailable = useMemo(
    () => {
      const langs = SUPPORTED_ROUTE_LANGUAGES.filter((lang) => availableLanguages.includes(lang));
      return langs.length > 0 ? langs : (['en'] as RouteLanguage[]);
    },
    [availableLanguages],
  );
  const value = useMemo(
    () => parsePath(pathname, normalizedAvailable).currentLang,
    [pathname, normalizedAvailable],
  );

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Language</span>
      <select
        value={value}
        onChange={(event) => {
          const targetLang = event.target.value as RouteLanguage;
          const { slug } = parsePath(pathname, normalizedAvailable);
          router.push(buildHref(targetLang, slug));
        }}
        aria-label="Select language"
        className="h-9 min-w-[112px]"
      >
        {normalizedAvailable.map((lang) => (
          <option key={lang} value={lang}>
            {ROUTE_LANGUAGE_LABELS[lang]}
          </option>
        ))}
      </select>
    </label>
  );
}
