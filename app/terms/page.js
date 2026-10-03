import SupportPage, { supportMetadata } from '../components/SupportPage';

export const metadata = supportMetadata('terms');

export default function Page() {
  return <SupportPage kind="terms" />;
}
