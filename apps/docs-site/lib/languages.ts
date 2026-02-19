export type RouteLanguage = 'en' | 'es' | 'ko' | 'ja';

export const SUPPORTED_ROUTE_LANGUAGES: RouteLanguage[] = ['en', 'es', 'ko', 'ja'];

export const ROUTE_LANGUAGE_LABELS: Record<RouteLanguage, string> = {
  en: 'English',
  es: 'Español',
  ko: '한국어',
  ja: '日本語',
};

export function isRouteLanguage(value: string): value is RouteLanguage {
  return SUPPORTED_ROUTE_LANGUAGES.includes(value as RouteLanguage);
}
