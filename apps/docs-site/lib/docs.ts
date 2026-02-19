import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { isRouteLanguage, SUPPORTED_ROUTE_LANGUAGES, type RouteLanguage } from './languages';

export type DocLanguage = RouteLanguage;

export type DocItem = {
  id: string;
  fileName: string;
  title: string;
  slugBase: string;
  href: string;
  lang: DocLanguage;
  body: string;
  lastUpdated: string;
};

export type SidebarGroup = {
  title: string;
  sections: SidebarSection[];
};

export type SidebarSection = {
  title: string;
  items: Array<Pick<DocItem, 'title' | 'href'>>;
};

export type DocSearchEntry = {
  title: string;
  href: string;
  excerpt: string;
  searchText: string;
};

type NavRef = {
  slug: string;
  label?: string;
};

type ParsedGroup = {
  title: string;
  sections: Array<{ title: string; refs: NavRef[] }>;
};

const DOCS_DIR = path.resolve(process.cwd(), '../../docs/content');
const SIDEBAR_PATH = path.resolve(process.cwd(), '../../docs/meta/_sidebar.md');
const lastUpdatedCache = new Map<string, string>();
const DOCS_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

function withBasePath(href: string): string {
  if (!DOCS_BASE_PATH) {
    return href;
  }
  if (!href.startsWith('/')) {
    return href;
  }
  if (href === DOCS_BASE_PATH || href.startsWith(`${DOCS_BASE_PATH}/`)) {
    return href;
  }
  return `${DOCS_BASE_PATH}${href}`;
}

function getContentLanguages(): RouteLanguage[] {
  if (!fs.existsSync(DOCS_DIR)) {
    return ['en'];
  }

  const directoryNames = fs
    .readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isRouteLanguage(entry.name.toLowerCase()))
    .map((entry) => entry.name.toLowerCase() as RouteLanguage);

  const ordered = SUPPORTED_ROUTE_LANGUAGES.filter((lang) => directoryNames.includes(lang));
  if (ordered.includes('en')) {
    return ordered;
  }

  return ['en', ...ordered];
}

const CONTENT_LANGUAGES: RouteLanguage[] = getContentLanguages();

export function getAvailableRouteLanguages(): RouteLanguage[] {
  return [...CONTENT_LANGUAGES];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function mapTitle(content: string, fallback: string): string {
  const heading = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '));

  if (heading) {
    return heading.slice(2).trim();
  }

  return fallback;
}

function parseRouteLanguage(value: string): RouteLanguage | null {
  const lower = String(value || '').toLowerCase();
  return isRouteLanguage(lower) ? lower : null;
}

function normalizeNavTarget(target: string): { slug: string; langHint: RouteLanguage | null } {
  const trimmed = String(target || '').trim().replace(/\.md$/i, '');
  if (!trimmed) {
    return { slug: '', langHint: null };
  }

  const byPrefix = trimmed.match(/^(en|es|ko|ja)\/(.+)$/i);
  if (byPrefix) {
    return {
      slug: slugify(byPrefix[2]),
      langHint: byPrefix[1].toLowerCase() as RouteLanguage,
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower.endsWith('.ko')) {
    return { slug: slugify(trimmed.slice(0, -3)), langHint: 'ko' };
  }
  if (lower.endsWith('.es')) {
    return { slug: slugify(trimmed.slice(0, -3)), langHint: 'es' };
  }
  if (lower.endsWith('.ja')) {
    return { slug: slugify(trimmed.slice(0, -3)), langHint: 'ja' };
  }

  return { slug: slugify(trimmed), langHint: null };
}

function toHref(rawTarget: string): string {
  const { slug, langHint } = normalizeNavTarget(rawTarget);
  if (!slug) {
    return '/docs/home';
  }
  return langHint && langHint !== 'en' ? `/docs/${langHint}/${slug}` : `/docs/${slug}`;
}

function replaceWikiLinks(markdown: string): string {
  const withWikiLinks = markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, rawTarget, rawLabel) => {
    const target = String(rawTarget || '').trim();
    const label = String(rawLabel || target).trim();
    return `[${label}](${withBasePath(toHref(target))})`;
  });

  return withWikiLinks.replace(/\]\(([^)]+)\)/g, (full, rawTarget) => {
    const target = String(rawTarget || '').trim();

    if (
      !target ||
      target.startsWith('http://') ||
      target.startsWith('https://') ||
      target.startsWith('mailto:') ||
      target.startsWith('#')
    ) {
      return full;
    }

    if (target.startsWith('/')) {
      // Keep absolute links but make them project-pages aware on GitHub Pages.
      return `](${withBasePath(target)})`;
    }

    const clean = target.replace(/\.md$/i, '');
    if (/^[A-Za-z0-9._/-]+$/.test(clean)) {
      return `](${withBasePath(toHref(clean))})`;
    }

    return full;
  });
}

function resolveLastUpdated(filePath: string): string {
  const cached = lastUpdatedCache.get(filePath);
  if (cached) {
    return cached;
  }

  const fallback = new Date(fs.statSync(filePath).mtime).toISOString().slice(0, 10);

  try {
    const gitDate = execSync(`git log -1 --format=%cs -- "${filePath}"`, {
      cwd: path.resolve(process.cwd(), '../..'),
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    })
      .trim()
      .slice(0, 10);

    const resolved = gitDate || fallback;
    lastUpdatedCache.set(filePath, resolved);
    return resolved;
  } catch {
    lastUpdatedCache.set(filePath, fallback);
    return fallback;
  }
}

function readDoc(language: RouteLanguage, fileName: string): DocItem | null {
  if (!fileName.endsWith('.md') || fileName.startsWith('_')) {
    return null;
  }

  const filePath = path.join(DOCS_DIR, language, fileName);
  const raw = fs.readFileSync(filePath, 'utf8');
  const slugBase = slugify(fileName.replace(/\.md$/i, ''));

  return {
    id: `${language}:${slugBase}`,
    fileName: `${language}/${fileName}`,
    title: mapTitle(raw, slugBase),
    slugBase,
    href: language === 'en' ? `/docs/${slugBase}` : `/docs/${language}/${slugBase}`,
    lang: language,
    body: replaceWikiLinks(raw),
    lastUpdated: resolveLastUpdated(filePath),
  };
}

function parseNavRefToken(token: string): NavRef | null {
  const wiki = token.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
  if (wiki) {
    const target = String(wiki[1] || '').trim();
    const label = String(wiki[2] || '').trim() || undefined;
    const { slug } = normalizeNavTarget(target);
    if (!slug) {
      return null;
    }
    return { slug, label };
  }

  const markdownLink = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (markdownLink) {
    const label = String(markdownLink[1] || '').trim() || undefined;
    const target = String(markdownLink[2] || '').trim();
    const { slug } = normalizeNavTarget(target);
    if (!slug) {
      return null;
    }
    return { slug, label };
  }

  return null;
}

function ensureSection(group: ParsedGroup, title: string): { title: string; refs: NavRef[] } {
  const existing = group.sections.find((section) => section.title === title);
  if (existing) {
    return existing;
  }
  const section = { title, refs: [] as NavRef[] };
  group.sections.push(section);
  return section;
}

function parseSidebarHierarchy(): ParsedGroup[] {
  if (!fs.existsSync(SIDEBAR_PATH)) {
    return [];
  }

  const groups: ParsedGroup[] = [];
  const lines = fs.readFileSync(SIDEBAR_PATH, 'utf8').split('\n');
  let currentGroup: ParsedGroup | null = null;
  let currentSection: { title: string; refs: NavRef[] } | null = null;

  for (const rawLine of lines) {
    const match = rawLine.match(/^([ \t]*)-\s+(.+)$/);
    if (!match) {
      continue;
    }

    const indent = (match[1] || '').replace(/\t/g, '  ').length;
    const level = Math.floor(indent / 2);
    const token = String(match[2] || '').trim();
    const maybeRef = parseNavRefToken(token);

    if (level <= 0) {
      if (maybeRef) {
        if (!currentGroup) {
          currentGroup = { title: 'Docs', sections: [] };
          groups.push(currentGroup);
        }
        ensureSection(currentGroup, 'General').refs.push(maybeRef);
      } else {
        currentGroup = { title: token, sections: [] };
        groups.push(currentGroup);
      }
      currentSection = null;
      continue;
    }

    if (!currentGroup) {
      currentGroup = { title: 'Docs', sections: [] };
      groups.push(currentGroup);
    }

    if (level === 1) {
      if (maybeRef) {
        ensureSection(currentGroup, 'General').refs.push(maybeRef);
        currentSection = null;
      } else {
        currentSection = ensureSection(currentGroup, token);
      }
      continue;
    }

    if (!currentSection) {
      currentSection = ensureSection(currentGroup, 'General');
    }

    if (maybeRef) {
      currentSection.refs.push(maybeRef);
    } else {
      currentSection = ensureSection(currentGroup, token);
    }
  }

  return groups.filter((group) => group.sections.some((section) => section.refs.length > 0));
}

function getRouteLanguageFallbackOrder(routeLang: RouteLanguage): RouteLanguage[] {
  const available = getAvailableRouteLanguages();
  const rest = available.filter((lang) => lang !== routeLang && lang !== 'en');

  if (routeLang === 'en') {
    return ['en', ...rest];
  }

  return [routeLang, 'en', ...rest];
}

function findDocForRouteLang(docs: DocItem[], slug: string, routeLang: RouteLanguage): DocItem | null {
  const order = getRouteLanguageFallbackOrder(routeLang);
  for (const lang of order) {
    const found = docs.find((doc) => doc.slugBase === slug && doc.lang === lang);
    if (found) {
      return found;
    }
  }
  return null;
}

function getPreferredDocsForRouteLang(docs: DocItem[], routeLang: RouteLanguage): DocItem[] {
  const slugSet = new Set(docs.map((doc) => doc.slugBase));
  const resolved: DocItem[] = [];

  for (const slug of slugSet) {
    const doc = findDocForRouteLang(docs, slug, routeLang);
    if (doc) {
      resolved.push(doc);
    }
  }

  return resolved.sort((a, b) => a.title.localeCompare(b.title));
}

export function getRouteLanguageFromSegments(segments: string[]): RouteLanguage {
  const first = segments.filter(Boolean)[0];
  const parsed = parseRouteLanguage(first || '');
  return parsed || 'en';
}

function getSlugFromSegments(segments: string[]): string {
  const normalized = segments.filter(Boolean);
  const routeLang = getRouteLanguageFromSegments(normalized);
  return routeLang === 'en' ? normalized.join('/') : normalized.slice(1).join('/');
}

export function buildDocHref(slugBase: string, routeLang: RouteLanguage): string {
  return routeLang === 'en' ? `/docs/${slugBase}` : `/docs/${routeLang}/${slugBase}`;
}

export function getAllDocs(): DocItem[] {
  const docs: DocItem[] = [];

  for (const lang of CONTENT_LANGUAGES) {
    const langDir = path.join(DOCS_DIR, lang);
    if (!fs.existsSync(langDir) || !fs.statSync(langDir).isDirectory()) {
      continue;
    }

    const files = fs.readdirSync(langDir);
    for (const file of files) {
      const item = readDoc(lang, file);
      if (item) {
        docs.push(item);
      }
    }
  }

  return docs;
}

export function getDocBySegments(segments: string[]): DocItem | null {
  const docs = getAllDocs();
  const routeLang = getRouteLanguageFromSegments(segments);
  const slug = getSlugFromSegments(segments);

  if (!slug) {
    return null;
  }

  return findDocForRouteLang(docs, slug, routeLang);
}

export function getDocParams(): Array<{ slug: string[] }> {
  const docs = getAllDocs();
  const slugs = Array.from(new Set(docs.map((doc) => doc.slugBase)));
  const params: Array<{ slug: string[] }> = [];

  for (const slug of slugs) {
    params.push({ slug: [slug] });
    for (const routeLang of getAvailableRouteLanguages()) {
      if (routeLang === 'en') {
        continue;
      }
      params.push({ slug: [routeLang, slug] });
    }
  }

  return params;
}

export function getSidebarGroups(routeLang: RouteLanguage): SidebarGroup[] {
  const docs = getAllDocs();
  const navGroups = parseSidebarHierarchy();
  const groups: SidebarGroup[] = [];
  const seenHrefs = new Set<string>();

  for (const navGroup of navGroups) {
    const sections: SidebarSection[] = [];

    for (const navSection of navGroup.sections) {
      const items: Array<Pick<DocItem, 'title' | 'href'>> = [];

      for (const ref of navSection.refs) {
        const doc = findDocForRouteLang(docs, ref.slug, routeLang);
        if (!doc) {
          continue;
        }

        const href = buildDocHref(doc.slugBase, routeLang);
        if (seenHrefs.has(href)) {
          continue;
        }

        seenHrefs.add(href);
        items.push({
          title: ref.label || doc.title,
          href,
        });
      }

      if (items.length > 0) {
        sections.push({ title: navSection.title, items });
      }
    }

    if (sections.length > 0) {
      groups.push({ title: navGroup.title, sections });
    }
  }

  const extras = getPreferredDocsForRouteLang(docs, routeLang)
    .map((doc) => ({ title: doc.title, href: buildDocHref(doc.slugBase, routeLang) }))
    .filter((item) => !seenHrefs.has(item.href))
    .sort((a, b) => a.title.localeCompare(b.title));

  if (extras.length > 0) {
    groups.push({
      title: 'Other',
      sections: [
        {
          title: 'General',
          items: extras,
        },
      ],
    });
  }

  return groups;
}

export function getDefaultHomeHref(routeLang: RouteLanguage): string {
  return routeLang === 'en' ? '/docs/home' : `/docs/${routeLang}/home`;
}

function toSearchableText(markdown: string): string {
  const withoutFencedCode = markdown.replace(/```[\s\S]*?```/g, ' ');
  const withoutInlineCode = withoutFencedCode.replace(/`[^`]*`/g, ' ');
  const withoutLinks = withoutInlineCode.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const withoutImages = withoutLinks.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  const withoutHeadings = withoutImages.replace(/^#{1,6}\s+/gm, '');
  const withoutBlockquotes = withoutHeadings.replace(/^\s*>\s?/gm, '');
  const withoutMarkers = withoutBlockquotes.replace(/[*_~#>-]/g, ' ');
  return withoutMarkers.replace(/\s+/g, ' ').trim();
}

function toExcerpt(text: string, maxLen = 180): string {
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen).trimEnd()}...`;
}

export function getDocSearchEntries(routeLang: RouteLanguage): DocSearchEntry[] {
  const docs = getPreferredDocsForRouteLang(getAllDocs(), routeLang);

  return docs.map((doc) => {
    const href = buildDocHref(doc.slugBase, routeLang);
    const bodyText = toSearchableText(doc.body);
    const excerpt = toExcerpt(bodyText, 200);
    const searchText = `${doc.title} ${bodyText}`.toLowerCase();

    return {
      title: doc.title,
      href,
      excerpt,
      searchText,
    };
  });
}
