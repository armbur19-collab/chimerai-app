// @chimerai component=UseChatHook version=2.0
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface ChatMessageData {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string | null;
  tokens?: number | null;
  createdAt?: string;
  streaming?: boolean;
}

export interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
  _count: {
    messages: number;
  };
}

export interface ModelOption {
  id: string;
  modelId: string;
  name: string;
  providerId: string;
  providerType: string;
  contextWindow: number;
  inputCost: number;
  outputCost: number;
  capabilities: string[];
  provider: {
    id: string;
    name: string;
    type: string;
  };
}

export interface MessageActions {
  onRegenerate?: (index: number) => void;
  onEdit?: (index: number, newContent: string) => void;
  onDelete?: (index: number) => void;
}

export interface UseChatOptions {
  onConversationCreated?: (id: string) => void;
  onError?: (error: string) => void;
}

export interface UseChatReturn {
  // State
  messages: ChatMessageData[];
  isStreaming: boolean;
  conversations: ConversationItem[];
  models: ModelOption[];
  selectedConversationId: string | null;
  selectedModelId: string;
  isLoadingConversation: boolean;
  isLoadingModels: boolean;
  systemPrompt: string;
  selectedPromptId: string | null;
  creditBalance: number | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  selectConversation: (id: string) => Promise<void>;
  startNewChat: () => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  setSelectedModelId: (id: string) => void;
  setSelectedPromptId: (id: string | null) => void;
  setSystemPrompt: (prompt: string) => void;
  regenerateMessage: (index: number) => Promise<void>;
  editMessage: (index: number, newContent: string) => Promise<void>;
  deleteMessage: (index: number) => void;
  refreshConversations: () => Promise<void>;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    conversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // --- Fetch Conversations ---
  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  }, []);

  // --- Fetch Models ---
  const fetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        const modelList = Array.isArray(data) ? data : data.models || [];
        setModels(modelList);
        if (modelList.length > 0 && !selectedModelId) {
          // Prefer provider's configured default model, fall back to first in list
          const defaultModel = modelList.find((m: any) => m.isProviderDefault) || modelList[0];
          setSelectedModelId(defaultModel.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  }, [selectedModelId]);

  

  // Load on mount
  useEffect(() => {
    refreshConversations();
    fetchModels();
    // billing not enabled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Select Conversation ---
  const selectConversation = useCallback(async (id: string) => {
    conversationIdRef.current = id; // Set ref immediately to prevent race condition
    setSelectedConversationId(id);
    setIsLoadingConversation(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(
          (data.messages || []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            model: m.model,
            tokens: m.tokens,
            createdAt: m.createdAt,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    } finally {
      setIsLoadingConversation(false);
    }
  }, []);

  // --- New Chat ---
  const startNewChat = useCallback(() => {
    setSelectedConversationId(null);
    setMessages([]);
    conversationIdRef.current = null;
  }, []);

  // --- Send Message (Streaming) ---
  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      const userMessage: ChatMessageData = { role: 'user', content };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      // Add empty assistant message placeholder
      const assistantMessage: ChatMessageData = {
        role: 'assistant',
        content: '',
        streaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        abortControllerRef.current = new AbortController();

        // Determine the model to use
        const selectedModel = models.find((m) => m.id === selectedModelId);
        const modelId = selectedModel?.modelId || 'gpt-4o-mini';
        const providerId = selectedModel?.providerId || undefined;

        // Collect all messages (excluding system — added separately)
        const messagesToSend = [...messages, userMessage].filter((m) => m.role !== 'system');

        const body: any = {
          model: modelId,
          messages: [
            ...(systemPrompt.trim()
              ? [{ role: 'system' as const, content: systemPrompt.trim() }]
              : []),
            ...messagesToSend.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          ],
          conversationId: conversationIdRef.current || undefined,
          providerId,
          promptId: selectedPromptId || undefined,
        };

        const res = await fetch('/api/v1/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
          throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'token') {
                // Update conversation ID from first token
                if (parsed.conversationId && !conversationIdRef.current) {
                  conversationIdRef.current = parsed.conversationId;
                  setSelectedConversationId(parsed.conversationId);
                  options.onConversationCreated?.(parsed.conversationId);
                }

                // Append token to last assistant message
                setMessages((prev) => {
                  const lastIdx = prev.length - 1;
                  if (lastIdx >= 0 && prev[lastIdx].role === 'assistant') {
                    return [
                      ...prev.slice(0, lastIdx),
                      { ...prev[lastIdx], content: prev[lastIdx].content + parsed.content },
                    ];
                  }
                  return prev;
                });
              } else if (parsed.type === 'done') {
                setMessages((prev) => {
                  const lastIdx = prev.length - 1;
                  if (lastIdx >= 0 && prev[lastIdx].role === 'assistant') {
                    return [
                      ...prev.slice(0, lastIdx),
                      { ...prev[lastIdx], streaming: false, model: modelId },
                    ];
                  }
                  return prev;
                });
              } else if (parsed.type === 'error') {
                throw new Error(parsed.message);
              }
            } catch (parseErr: any) {
              if (parseErr.message && !parseErr.message.includes('JSON')) {
                throw parseErr;
              }
              console.error('Failed to parse SSE data:', parseErr);
            }
          }
        }

        // Refresh conversations to pick up new/updated titles
        refreshConversations();
        
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            if (lastIdx >= 0 && prev[lastIdx].role === 'assistant') {
              return [
                ...prev.slice(0, lastIdx),
                { ...prev[lastIdx], content: `Error: ${error.message}`, streaming: false },
              ];
            }
            return prev;
          });
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, messages, models, selectedModelId, systemPrompt, options, refreshConversations]
  );

  // --- Stop Streaming ---
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  // --- Delete Conversation ---
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (selectedConversationId === id) {
            startNewChat();
          }
        }
      } catch (err) {
        console.error('Failed to delete conversation:', err);
      }
    },
    [selectedConversationId, startNewChat]
  );

  // --- Rename Conversation ---
  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  }, []);

  // --- Regenerate Message ---
  const regenerateMessage = useCallback(
    async (index: number) => {
      if (isStreaming) return;
      let userMsgIndex = index - 1;
      while (userMsgIndex >= 0 && messages[userMsgIndex].role !== 'user') {
        userMsgIndex--;
      }
      if (userMsgIndex < 0) return;

      const userContent = messages[userMsgIndex].content;
      const truncated = messages.slice(0, userMsgIndex);
      setMessages(truncated);
      setTimeout(() => sendMessage(userContent), 50);
    },
    [isStreaming, messages, sendMessage]
  );

  // --- Edit Message ---
  const editMessage = useCallback(
    async (index: number, newContent: string) => {
      if (isStreaming) return;
      const truncated = messages.slice(0, index);
      setMessages(truncated);
      setTimeout(() => sendMessage(newContent), 50);
    },
    [isStreaming, messages, sendMessage]
  );

  // --- Delete Message ---
  const deleteMessage = useCallback((index: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    messages,
    isStreaming,
    conversations,
    models,
    selectedConversationId,
    selectedModelId,
    isLoadingConversation,
    isLoadingModels,
    systemPrompt,
    selectedPromptId,
    creditBalance,
    sendMessage,
    stopStreaming,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    setSelectedModelId,
    setSelectedPromptId,
    setSystemPrompt,
    regenerateMessage,
    editMessage,
    deleteMessage,
    refreshConversations,
  };
}
