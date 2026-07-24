// @chimerai component=ChatStreamRoute version=2.0
/**
 * Streaming Chat API Route — Direct Provider Communication with DB Persistence
 * POST /api/v1/chat/stream
 *
 * Communicates DIRECTLY with LLM providers (OpenAI, Anthropic, Ollama, Groq).
 * Creates/loads conversations, saves messages to DB, streams tokens via SSE.
 * No external AI Service required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveAuth } from '@/lib/auth/resolve-auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

/** Default base URLs for known provider types */
function getDefaultBaseUrl(providerType: string): string {
  const defaults: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    ollama: 'http://localhost:11434',
    groq: 'https://api.groq.com/openai/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta',
  };
  return defaults[providerType] || 'https://api.openai.com/v1';
}

/** Content extractor based on provider type */
function getContentExtractor(providerType: string) {
  switch (providerType) {
    case 'anthropic':
      return (parsed: any): string => {
        if (parsed.type === 'content_block_delta') {
          return parsed.delta?.text || '';
        }
        return '';
      };
    case 'ollama':
      return (parsed: any): string => {
        return parsed.message?.content || '';
      };
    case 'openai':
    case 'groq':
    case 'custom':
    default:
      return (parsed: any): string => {
        return parsed.choices?.[0]?.delta?.content || '';
      };
  }
}

/** Token estimation as fallback when provider doesn't return exact counts */
function estimateTokens(text: string, providerType: string): number {
  const ratios: Record<string, number> = {
    openai: 4.3,
    groq: 4.3,
    anthropic: 4.1,
    ollama: 4.0,
    google: 4.0,
  };
  const ratio = ratios[providerType] || 4.0;
  return Math.ceil(text.length / ratio);
}

export async function POST(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await resolveAuth(request);
    } catch (error: any) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: error.status || 401 });
    }

    // Scope check for API-Key auth
    if (auth.authMethod === 'api-key' && auth.scopes) {
      const hasChat = auth.scopes.includes('chat') || auth.scopes.includes('*') || auth.scopes.length === 0;
      if (!hasChat) {
        return NextResponse.json({ error: 'Insufficient scope. Required: chat' }, { status: 403 });
      }
    }

    // Permission check: chat:use (only for session-authenticated users, not API-Keys)
    if (auth.userId && auth.authMethod !== 'api-key') {
      try {
        const { requirePermission } = await import('@/lib/permissions');
        const canChat = await requirePermission(auth.userId, 'chat:use');
        if (!canChat) {
          return NextResponse.json(
            { error: 'You do not have permission to use the chat. Contact your administrator.' },
            { status: 403 }
          );
        }
      } catch {
        // RBAC (lib/permissions) not installed — allow all authenticated users
      }
    }

    const payload = await request.json();
    const { messages, model, providerId, conversationId, promptId, promptCategory } = payload;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // --- 1. Load or create conversation ---
    let conversation;
    if (conversationId) {
      conversation = await (prisma as any).conversation.findUnique({
        where: { id: conversationId, userId: auth.userId },
      });
    }
    if (!conversation) {
      const firstUserMessage = messages.find((m: any) => m.role === 'user');
      const title = firstUserMessage?.content?.slice(0, 50) || 'New Chat';
      conversation = await (prisma as any).conversation.create({
        data: {
          userId: auth.userId,
          title,
          model: model || undefined,
          providerId: providerId || undefined,
        },
      });
    }

    // --- 2. Save user message BEFORE streaming ---
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
    if (lastUserMessage) {
      await (prisma as any).message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: lastUserMessage.content,
        },
      });
    }

    // --- 2.5. Load system prompt from prompt template ---
    let systemPrompt: string | undefined;
    try {
      if (promptId) {
        const tmpl = await (prisma as any).promptTemplate.findFirst({
          where: { id: promptId, isActive: true },
        });
        if (tmpl) systemPrompt = tmpl.content;
      } else {
        const category = promptCategory || 'system';
        const defaultTmpl = await (prisma as any).promptTemplate.findFirst({
          where: { category, isDefault: true, isActive: true },
        });
        if (defaultTmpl) systemPrompt = defaultTmpl.content;
      }
    } catch { /* promptTemplate table may not exist in this app — continue without */ }

    // Prepend system message (overrides any system message sent by client)
    const messagesWithSystem = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages.filter((m: any) => m.role !== 'system')]
      : messages;

    // --- 3. Load provider and decrypt API key ---
    let provider;
    let modelRecord: any = null;
    if (providerId) {
      provider = await (prisma as any).provider.findUnique({ where: { id: providerId } });
    }
    // If a model was specified but no provider, look up which provider owns this model
    if (!provider && model) {
      modelRecord = await (prisma as any).model.findFirst({
        where: { modelId: model, provider: { status: 'active' } },
        include: { provider: true },
      });
      if (modelRecord?.provider) {
        provider = modelRecord.provider;
      }
    }
    // Fallback: if providerId path was taken, still load modelRecord for cost calculation
    if (provider && !modelRecord && model) {
      modelRecord = await (prisma as any).model.findFirst({
        where: { providerId: provider.id, modelId: model },
      });
    }
    // Fallback: first active provider
    if (!provider) {
      provider = await (prisma as any).provider.findFirst({
        where: { status: 'active' },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!provider) {
      return NextResponse.json({ error: 'No active provider found. Please configure a provider first.' }, { status: 400 });
    }

    let apiKey: string | null = null;
    try {
      apiKey = provider.apiKey ? decrypt(provider.apiKey) : null;
    } catch (err) {
      console.error('Failed to decrypt provider API key:', err);
      return NextResponse.json({ error: 'Provider API key decryption failed' }, { status: 500 });
    }
    const baseUrl = provider.baseUrl || getDefaultBaseUrl(provider.type);
    const resolvedKey = apiKey || '';

    // --- 4. Resolve model: explicit request > provider default > error ---
    // Parse config safely (PostgreSQL returns JSON object, SQLite returns JSON string)
    const rawConfig = provider.config;
    const providerConfig: { defaultModel?: string } | null =
      typeof rawConfig === 'string' ? (() => { try { return JSON.parse(rawConfig); } catch { return null; } })() : (rawConfig as any) || null;
    const modelId = model || providerConfig?.defaultModel;

    if (!modelId) {
      return NextResponse.json(
        { error: 'No model specified and no default model configured for this provider. Set a default model in provider settings.' },
        { status: 400 }
      );
    }

    let llmResponse: Response;
    const streamStartTime = Date.now();

    switch (provider.type) {
      case 'anthropic':
        llmResponse = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': resolvedKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 4096,
            messages: messagesWithSystem.filter((m: any) => m.role !== 'system'),
            system: messagesWithSystem.find((m: any) => m.role === 'system')?.content || undefined,
            stream: true,
          }),
        });
        break;

      case 'ollama':
        llmResponse = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelId,
            messages: messagesWithSystem,
            stream: true,
          }),
        });
        break;

      case 'openai':
      case 'groq':
      case 'custom':
      default:
        llmResponse = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resolvedKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            messages: messagesWithSystem,
            stream: true,
          }),
        });
        break;
    }

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text().catch(() => 'LLM provider error');
      console.error(`LLM provider error (${provider.type}):`, errorText);
      return NextResponse.json(
        { error: `Provider error: ${errorText.slice(0, 200)}` },
        { status: llmResponse.status }
      );
    }

    const llmReader = llmResponse.body?.getReader();
    if (!llmReader) {
      return NextResponse.json({ error: 'No response stream from provider' }, { status: 502 });
    }

    // --- 5. Stream parsing + forwarding ---
    const extractContent = getContentExtractor(provider.type);

    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let fullResponse = '';
          let buffer = '';
          let currentEventType: string | null = null;
          let tokensUsed: number | null = null;

          const sendToken = (content: string) => {
            fullResponse += content;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'token',
                content,
                conversationId: conversation.id,
              })}\n\n`)
            );
          };

          try {
            while (true) {
              const { done, value } = await llmReader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim() === '') continue;

                // SSE "event:" lines (Anthropic uses these)
                if (line.startsWith('event: ')) {
                  currentEventType = line.slice(7).trim();
                  continue;
                }

                // SSE "data:" lines (OpenAI, Groq, Anthropic)
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(data);

                    if (provider.type === 'anthropic') {
                      if (currentEventType === 'content_block_delta') {
                        const text = parsed.delta?.text || '';
                        if (text) sendToken(text);
                      } else if (currentEventType === 'message_delta') {
                        if (parsed.usage?.output_tokens) {
                          tokensUsed = parsed.usage.output_tokens;
                        }
                      } else if (currentEventType === 'message_stop') {
                        // Stream ended
                      }
                    } else {
                      const content = extractContent(parsed);
                      if (content) sendToken(content);
                    }
                  } catch { /* skip unparseable lines */ }

                  currentEventType = null;
                }
                // Ollama: raw JSON per line (no "data:" prefix)
                else if (line.trim().startsWith('{')) {
                  try {
                    const parsed = JSON.parse(line);
                    if (parsed.done) continue;
                    const content = extractContent(parsed);
                    if (content) sendToken(content);
                  } catch { /* skip */ }
                }
              }
            }

            // --- 6. Save assistant message after stream ---
            if (tokensUsed === null) {
              tokensUsed = estimateTokens(fullResponse, provider.type);
            }
            await (prisma as any).message.create({
              data: {
                conversationId: conversation.id,
                role: 'assistant',
                content: fullResponse,
                model: modelId,
                tokens: tokensUsed,
              },
            });

            // --- 6b. Track API usage for billing/credits ---
            const inputTokens = estimateTokens(
              messagesWithSystem.map((m: any) => m.content).join(' '),
              provider.type
            );
            const inputCostPerM  = modelRecord?.inputCost  ?? 0;
            const outputCostPerM = modelRecord?.outputCost ?? 0;
            const calculatedCost = (inputTokens * inputCostPerM / 1_000_000)
                                 + (tokensUsed  * outputCostPerM / 1_000_000);
            const responseTime = Date.now() - streamStartTime;
            try {
              await (prisma as any).apiUsage.create({
                data: {
                  userId: auth.userId,
                  providerId: provider.id,
                  model: modelId,
                  endpoint: '/api/v1/chat/stream',
                  promptTokens: inputTokens,
                  completionTokens: tokensUsed,
                  totalTokens: inputTokens + tokensUsed,
                  tokensUsed: inputTokens + tokensUsed,
                  creditsUsed: Math.ceil((inputTokens + tokensUsed) / 1000),
                  cost: calculatedCost,
                  success: true,
                  responseTime: responseTime,
                },
              });
            } catch (usageError) {
              console.error('Failed to track API usage:', usageError);
            }

            // Update conversation updatedAt
            await (prisma as any).conversation.update({
              where: { id: conversation.id },
              data: { updatedAt: new Date() },
            });

            // Send done event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'done',
                conversationId: conversation.id,
              })}\n\n`)
            );
          } catch (error: any) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                message: error.message || 'Stream error',
              })}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      }
    );
  } catch (error: any) {
    console.error('Stream route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
