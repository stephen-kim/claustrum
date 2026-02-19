import { RootRedirect } from './components/root-redirect';
import { getAvailableRouteLanguages } from '../lib/docs';

export default function DocsHomePage() {
  return <RootRedirect availableLanguages={getAvailableRouteLanguages()} />;
}
