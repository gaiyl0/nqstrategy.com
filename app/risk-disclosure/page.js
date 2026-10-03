import SupportPage, { supportMetadata } from '../components/SupportPage';

export const metadata = supportMetadata('risk-disclosure');

export default function Page() {
  return <SupportPage kind="risk-disclosure" />;
}
