import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'inline-demo',
  description: 'Host product demos and generate a repointable email-signature chip that links to them.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
