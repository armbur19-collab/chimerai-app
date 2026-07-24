// @chimerai component=ChatPage version=2.0
'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAppName } from '@/lib/use-app-name';
import { useChat } from '@/components/chat/use-chat';
import { ChatMessage } from '@/components/chat/chat-message';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { ModelSelector } from '@/components/chat/model-selector';
import type { MessageActions } from '@/components/chat/chat-message';

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const appName = useAppName();

  const {
    messages,
    isStreaming,
    conversations,
    selectedConversationId,
    models,
    selectedModelId,
    creditBalance,
    isLoadingConversation,
    sendMessage,
    stopStreaming,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    setSelectedModelId,
    regenerateMessage,
    editMessage,
    deleteMessage,
  } = useChat();

  // Auth redirect
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // Set page title
  useEffect(() => {
    document.title = `Chat — ${appName}`;
  }, [appName]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close sidebar on conversation select (mobile)
  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    startNewChat();
    setSidebarOpen(false);
  };

  if (status === 'loading' || !session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const messageActions: MessageActions = {
    onRegenerate: regenerateMessage,
    onEdit: editMessage,
    onDelete: deleteMessage,
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 relative">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-auto`}>
        <ChatSidebar
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          onDelete={deleteConversation}
          onRename={renameConversation}
        />
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 px-4 py-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 md:hidden"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <ModelSelector
            models={models}
            value={selectedModelId}
            onValueChange={setSelectedModelId}
            disabled={isStreaming}
          />
          <div className="flex-1" />
          {selectedConversationId && (
            <span className="text-xs text-gray-400">Conversation active</span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title="Sign out"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingConversation ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">Loading conversation...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <svg className="h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">Start a conversation</h2>
              <p className="text-sm text-gray-400">Send a message to begin chatting with AI</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={msg.id || idx}
                  message={msg}
                  index={idx}
                  actions={messageActions}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          creditBalance={creditBalance}
        />
      </main>
    </div>
  );
}
