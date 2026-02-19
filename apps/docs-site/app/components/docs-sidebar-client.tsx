'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { DocSearchEntry, SidebarGroup } from '../../lib/docs';

type Props = {
  groups: SidebarGroup[];
  searchEntries: DocSearchEntry[];
  currentHref: string;
};

function normalizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesTokens(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }
  const normalized = text.toLowerCase();
  return tokens.every((token) => normalized.includes(token));
}

type RankedResult = {
  title: string;
  href: string;
  excerpt: string;
  score: number;
};

export function DocsSidebarClient({ groups, searchEntries, currentHref }: Props) {
  const [query, setQuery] = useState('');
  const tokens = useMemo(() => normalizeQuery(query), [query]);
  const normalizedQuery = useMemo(() => query.toLowerCase().trim(), [query]);

  const rankedResults = useMemo(() => {
    if (tokens.length === 0) {
      return [];
    }

    const results: RankedResult[] = [];
    for (const entry of searchEntries) {
      if (!matchesTokens(entry.searchText, tokens)) {
        continue;
      }

      const titleLower = entry.title.toLowerCase();
      let titleHits = 0;
      let bodyHits = 0;
      for (const token of tokens) {
        if (titleLower.includes(token)) {
          titleHits += 1;
        } else {
          bodyHits += 1;
        }
      }

      const phraseBonus = normalizedQuery.length > 0 && entry.searchText.includes(normalizedQuery) ? 2 : 0;
      const score = titleHits * 3 + bodyHits + phraseBonus;

      results.push({
        title: entry.title,
        href: entry.href,
        excerpt: entry.excerpt,
        score,
      });
    }

    return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 40);
  }, [normalizedQuery, searchEntries, tokens]);

  const showSearchResults = tokens.length > 0;

  const filteredItemCount = showSearchResults
    ? rankedResults.length
    : groups.reduce(
        (groupAcc, group) => groupAcc + group.sections.reduce((sectionAcc, section) => sectionAcc + section.items.length, 0),
        0,
      );

  return (
    <aside className="panel hidden h-fit lg:block">
      <div className="panel-body space-y-4 text-sm">
        <div className="space-y-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents..."
            aria-label="Search documents"
            className="docs-search-input h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {tokens.length > 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              {filteredItemCount > 0 ? `${filteredItemCount} result(s)` : 'No results'}
            </p>
          ) : null}
        </div>

        {showSearchResults ? (
          <div className="space-y-2">
            <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Documents</p>
            <ul className="space-y-2">
              {rankedResults.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded px-2 py-2 no-underline transition-colors ${
                      currentHref === item.href ? 'bg-primary/20 text-primary' : 'hover:bg-muted/40'
                    }`}
                  >
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    {item.excerpt ? <p className="mt-1 text-xs text-muted-foreground">{item.excerpt}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <details key={group.title} open>
                <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </summary>
                <div className="mt-2 space-y-2">
                  {group.sections.map((section) => (
                    <div key={`${group.title}:${section.title}`}>
                      <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                        {section.title}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {section.items.map((item) => (
                          <li key={`${group.title}:${section.title}:${item.href}`}>
                            <Link
                              href={item.href}
                              className={`block rounded px-2 py-1 no-underline transition-colors ${
                                currentHref === item.href ? 'bg-primary/20 text-primary' : 'hover:bg-muted/40'
                              }`}
                            >
                              {item.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
