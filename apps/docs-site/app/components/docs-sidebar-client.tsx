'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { SidebarGroup } from '../../lib/docs';

type Props = {
  groups: SidebarGroup[];
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

export function DocsSidebarClient({ groups, currentHref }: Props) {
  const [query, setQuery] = useState('');
  const tokens = useMemo(() => normalizeQuery(query), [query]);

  const filteredGroups = useMemo(() => {
    if (tokens.length === 0) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        sections: group.sections
          .map((section) => ({
            ...section,
            items: section.items.filter((item) => matchesTokens(`${item.title} ${item.href}`, tokens)),
          }))
          .filter((section) => section.items.length > 0),
      }))
      .filter((group) => group.sections.length > 0);
  }, [groups, tokens]);

  const filteredItemCount = useMemo(
    () =>
      filteredGroups.reduce(
        (groupAcc, group) => groupAcc + group.sections.reduce((sectionAcc, section) => sectionAcc + section.items.length, 0),
        0,
      ),
    [filteredGroups],
  );

  return (
    <aside className="panel hidden h-fit lg:block">
      <div className="panel-body space-y-4 text-sm">
        <div className="space-y-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docs..."
            aria-label="Search docs"
            className="docs-search-input h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {tokens.length > 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              {filteredItemCount > 0 ? `${filteredItemCount} result(s)` : 'No results'}
            </p>
          ) : null}
        </div>

        <div className="space-y-6">
          {filteredGroups.map((group) => (
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
      </div>
    </aside>
  );
}
