// @chimerai component=ProviderTestRoute version=1.0
/**
 * Provider Test API Route
 * POST /api/providers/[id]/test — Test provider connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

/** Provider types that work without an API key (e.g. local services) */
const KEYLESS_PROVIDERS = ['ollama'];

function getDefaultBaseUrl(type: string): string {
  switch (type) {
    case 'openai':    return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com/v1';
    case 'ollama':    return 'http://localhost:11434';
    case 'groq':      return 'https://api.groq.com/openai/v1';
    case 'google':    return 'https://generativelanguage.googleapis.com/v1beta';
    default:          return 'https://api.openai.com/v1';
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const provider = await prisma.provider.findUnique({
      where: { id: id },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    const baseUrl = provider.baseUrl || getDefaultBaseUrl(provider.type);
    const startTime = Date.now();
    let result: any = { success: false, responseTime: 0, details: {} };

    // Decrypt API key — keyless providers (e.g. Ollama) skip this
    const requiresKey = !KEYLESS_PROVIDERS.includes(provider.type);
    let apiKey: string | null = null;

    if (provider.apiKey) {
      try {
        apiKey = decrypt(provider.apiKey);
      } catch (decryptError: any) {
        return NextResponse.json({
          success: false,
          responseTime: 0,
          errorMessage: 'Failed to decrypt API key. Please re-enter the API key for this provider.',
          details: {},
        }, { status: 500 });
      }
    }

    if (requiresKey && !apiKey) {
      return NextResponse.json({
        success: false,
        responseTime: 0,
        errorMessage: 'No API key configured. Please edit the provider and add an API key.',
        details: {},
      }, { status: 400 });
    }

    // At this point apiKey is either a valid string or null (for keyless providers)
    const resolvedKey = apiKey ?? '';

    try {

      switch (provider.type) {
        case 'openai': {
          const resp = await fetch(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${resolvedKey}` },
            signal: AbortSignal.timeout(10000),
          });
          const responseTime = Date.now() - startTime;
          if (resp.ok) {
            const data = await resp.json();
            result = { success: true, responseTime, details: { chatTest: true, modelsFound: data.data?.length || 0 } };
          } else {
            throw new Error(`API returned ${resp.status}: ${resp.statusText}`);
          }
          break;
        }

        case 'anthropic': {
          const resp = await fetch(`${baseUrl}/messages`, {
            method: 'POST',
            headers: {
              'x-api-key': resolvedKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }],
            }),
            signal: AbortSignal.timeout(10000),
          });
          const responseTime = Date.now() - startTime;
          if (resp.ok) {
            result = { success: true, responseTime, details: { chatTest: true } };
          } else {
            throw new Error(`API returned ${resp.status}: ${resp.statusText}`);
          }
          break;
        }

        case 'ollama': {
          const resp = await fetch(`${baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(10000),
          });
          const responseTime = Date.now() - startTime;
          if (resp.ok) {
            const data = await resp.json();
            result = { success: true, responseTime, details: { chatTest: true, modelsFound: data.models?.length || 0 } };
          } else {
            throw new Error(`API returned ${resp.status}: ${resp.statusText}`);
          }
          break;
        }

        default: {
          const resp = await fetch(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${resolvedKey}` },
            signal: AbortSignal.timeout(10000),
          });
          const responseTime = Date.now() - startTime;
          result = { success: resp.ok, responseTime, details: { chatTest: resp.ok } };
          if (!resp.ok) throw new Error(`API returned ${resp.status}: ${resp.statusText}`);
        }
      }

      // Update status + health
      await prisma.provider.update({
        where: { id: id },
        data: { status: 'active' },
      });

      await prisma.providerHealth.upsert({
        where: { providerId: id },
        create: {
          providerId: id, status: 'healthy',
          responseTime: result.responseTime, lastCheck: new Date(),
          modelsAvailable: result.details.modelsFound || 0,
          chatAvailable: result.details.chatTest || false,
          apiKeyValid: true,
        },
        update: {
          status: 'healthy', responseTime: result.responseTime,
          lastCheck: new Date(), modelsAvailable: result.details.modelsFound || 0,
          chatAvailable: result.details.chatTest || false,
          apiKeyValid: true, errorMessage: null,
        },
      });

      return NextResponse.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      result = { success: false, responseTime, errorMessage: error.message, details: {} };

      await prisma.provider.update({
        where: { id: id },
        data: { status: 'error' },
      });

      await prisma.providerHealth.upsert({
        where: { providerId: id },
        create: {
          providerId: id, status: 'unhealthy', responseTime,
          lastCheck: new Date(), errorMessage: error.message,
          modelsAvailable: 0, chatAvailable: false, apiKeyValid: false,
        },
        update: {
          status: 'unhealthy', responseTime, lastCheck: new Date(),
          errorMessage: error.message, chatAvailable: false, apiKeyValid: false,
        },
      });

      return NextResponse.json(result, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error testing provider:', error);
    return NextResponse.json(
      { error: 'Failed to test provider', details: error.message },
      { status: 500 }
    );
  }
}
