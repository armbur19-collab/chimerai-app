// @chimerai component=AppLayoutWithAuth version=1.2
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/components/SessionProvider';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false });

export const metadata: Metadata = {
  title: 'final',
  description: 'AI Chat Platform powered by ChimerAI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionProvider>
            {children}
            <Toaster richColors position="top-right" />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
