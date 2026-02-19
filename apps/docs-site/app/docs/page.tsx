import { RootRedirect } from '../components/root-redirect';
import { getAvailableRouteLanguages } from '../../lib/docs';

export default function DocsIndexPage() {
  return <RootRedirect availableLanguages={getAvailableRouteLanguages()} />;
}
