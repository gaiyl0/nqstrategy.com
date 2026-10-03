import SupportPage, { supportMetadata } from '../components/SupportPage';

export const metadata = supportMetadata('help');

export default function Page() {
  return <SupportPage kind="help" />;
}
