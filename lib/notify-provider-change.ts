// @chimerai component=NotifyProviderChangeLib version=1.0
/**
 * Notify the AI Service that provider configuration has changed.
 * Triggers cache invalidation so the service fetches fresh provider data.
 *
 * Non-critical: failures are logged but don't throw.
 */

export async function notifyProviderChange(): Promise<void> {
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8002';
  const internalToken = process.env.INTERNAL_API_TOKEN;

  if (!internalToken) {
    console.warn('Cannot notify AI service: INTERNAL_API_TOKEN not configured');
    return;
  }

  try {
    const resp = await fetch(`${aiServiceUrl}/api/internal/invalidate-cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${internalToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (resp.ok) {
      console.log('AI service provider cache invalidated');
    } else {
      console.warn(`Failed to invalidate AI service cache: ${resp.status}`);
    }
  } catch (error: any) {
    // Non-critical: AI service might not be running
    console.debug(`Could not reach AI service: ${error.message}`);
  }
}
