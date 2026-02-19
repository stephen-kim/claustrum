import Link from 'next/link';
import { getSidebarGroups } from '../../lib/docs';
import { type RouteLanguage } from '../../lib/languages';

export function DocsSidebar({ lang, currentHref }: { lang: RouteLanguage; currentHref: string }) {
  const groups = getSidebarGroups(lang);

  return (
    <aside className="panel hidden h-fit lg:block">
      <div className="panel-body space-y-4 text-sm">
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
    </aside>
  );
}
