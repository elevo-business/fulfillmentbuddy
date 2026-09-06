import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kurzcheck — Fulfillmentbuddy',
  description:
    'Finde in 2 Minuten heraus, wo dein Fulfillment aktuell steht — und worauf es als Nächstes ankommt.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
