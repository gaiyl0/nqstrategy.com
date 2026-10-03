import SupportPage, { supportMetadata } from '../components/SupportPage';

export const metadata = supportMetadata('privacy');

export default function Page() {
  return <SupportPage kind="privacy" />;
}
