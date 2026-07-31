// @chimerai component=DashboardPage version=1.2
'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session } = useSession();

  const links = [
    { href: '/dashboard/providers', label: 'AI Providers', icon: '🔌', description: 'Manage AI model providers and API keys' },
    { href: '/dashboard/prompts', label: 'Prompt Templates', icon: '📝', description: 'Create and manage system prompts' },
    { href: '/chat', label: 'Chat', icon: '💬', description: 'AI chat conversations' },
    { href: '/rag', label: 'RAG', icon: '🔍', description: 'Upload and search documents (Retrieval Augmented Generation)' },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 dark:text-white">
          Welcome{session?.user?.name ? `, ${session.user.name}` : ''}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Your ChimerAI Dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
          >
            <div className="text-3xl mb-3">{link.icon}</div>
            <h2 className="text-xl font-semibold mb-2 dark:text-white">{link.label}</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
