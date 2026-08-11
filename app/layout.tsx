import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import { Providers } from '@/app/providers';
import { APP_NAME } from '@/lib/constants';
import './globals.css';

const fontThai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-thai',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'ระบบจัดการราคารับซื้อของเก่า',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${fontThai.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
