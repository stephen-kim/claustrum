import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LanguageSwitcher } from './components/language-switcher';
import { getAvailableRouteLanguages } from '../lib/docs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Claustrum Docs',
  description: 'Claustrum documentation site',
};

const GITHUB_REPO_URL = 'https://github.com/stephen-kim/claustrum';
const GITHUB_STARS_BADGE_URL =
  'https://img.shields.io/github/stars/stephen-kim/claustrum?style=social&label=Star';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const availableLanguages = getAvailableRouteLanguages();

  return (
    <html lang="en" className="dark">
      <body>
        <header className="border-b border-border/70 bg-background/70 backdrop-blur">
          <div className="container-docs flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="inline-flex items-center gap-3 text-foreground no-underline">
                <Image
                  src="/brand/logo-white.svg"
                  alt="Claustrum"
                  width={28}
                  height={28}
                  className="h-7 w-7"
                  priority
                />
                <div>
                  <p className="text-lg font-semibold leading-none">Claustrum Docs</p>
                  <p className="subtitle">GitHub Pages documentation for Claustrum</p>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="button-link px-2 py-1"
                aria-label="Open Claustrum GitHub repository"
              >
                <Image
                  src={GITHUB_STARS_BADGE_URL}
                  alt="Star Claustrum on GitHub"
                  width={96}
                  height={20}
                  className="h-5 w-auto"
                  unoptimized
                />
              </a>
              <LanguageSwitcher availableLanguages={availableLanguages} />
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
