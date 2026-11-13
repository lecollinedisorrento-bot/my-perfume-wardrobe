import type { AIProvider } from './provider';
import { MockProvider } from './mock';
import { AnthropicProvider } from './anthropic';

/** Builds the configured provider from env, or null when AI is not configured. */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): AIProvider | null {
  const kind = (env.AI_PROVIDER || 'anthropic').toLowerCase();
  if (kind === 'none') return null;
  if (kind === 'mock') {
    // Automated tests only. Reported as engine "mock:test-fixture" in the UI.
    console.warn('[ai] Using the deterministic TEST provider (AI_PROVIDER=mock). This is not real AI.');
    return new MockProvider();
  }
  if (kind === 'anthropic') {
    const key = env.ANTHROPIC_API_KEY?.trim();
    if (!key) return null;
    return new AnthropicProvider(env.AI_MODEL?.trim() || 'claude-opus-5-5', key);
  }
  console.warn(`[ai] Unknown AI_PROVIDER "${kind}" — AI disabled.`);
  return null;
}
