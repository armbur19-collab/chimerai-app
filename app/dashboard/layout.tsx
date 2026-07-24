// @chimerai component=DashboardLayout version=1.3
'use client';

import { useSession, signOut } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppName } from '@/lib/use-app-name';
import { NAV_ITEMS } from '@/lib/nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const appName = useAppName();

  useEffect(() => {
    fetch('/api/theme').then(r => r.json()).then(t => {
      if (t.logoUrl) setLogoUrl(t.logoUrl);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      redirect('/auth/signin');
    }
    setIsLoading(false);
  }, [session, status]);

  useEffect(() => {
    document.title = `Dashboard — ${appName}`;
  }, [appName]);

  if (isLoading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-900">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-800 shadow"
        aria-label="Toggle menu"
      >
        <svg className="h-5 w-5 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed z-40 inset-y-0 left-0 w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 flex flex-col transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-4 mt-12 md:mt-0 flex items-center gap-2">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain shrink-0 rounded" />
          )}
          <h2 className="text-lg font-bold dark:text-white">{appName}</h2>
        </div>
        <nav className="space-y-2 flex-1">
          {NAV_ITEMS
            .filter(item => !item.adminOnly || (session?.user as any)?.role === 'admin')
            .map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="block px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                {item.label}
              </Link>
            ))
          }
        </nav>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="px-4 py-1 text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
            {session?.user?.email}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full flex items-center gap-2 px-4 py-2 rounded text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 pt-16 md:pt-8 dark:text-white">
        {children}
      </main>
    </div>
  );
}
