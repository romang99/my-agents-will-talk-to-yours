// provider.js — LLM provider registry.
// All available providers are instantiated at boot; the UI chooses per run.
//   demo        always available — deterministic, offline, free (simulated dialogue)
//   claude-cli  when the `claude` binary is on PATH (local Claude Code subscription)
//   anthropic   when ANTHROPIC_API_KEY is set (official SDK; optional dependency)
// PROVIDER env var selects the *default*, not a restriction.

import { execFileSync } from 'node:child_process';
import { ClaudeCliProvider } from './claude-cli.js';
import { DemoProvider } from './demo.js';

export const PROVIDER_LABELS = {
  demo: 'Demo — instant, simulated dialogue (no LLM)',
  'claude-cli': 'Claude (subscription) — live, takes minutes',
  anthropic: 'Claude API — live',
};

function claudeCliAvailable() {
  try {
    execFileSync('which', ['claude'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** Instantiate every provider that can work in this environment. */
export async function availableProviders() {
  const providers = new Map();
  providers.set('demo', new DemoProvider());
  if (claudeCliAvailable()) providers.set('claude-cli', new ClaudeCliProvider());
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { AnthropicSdkProvider } = await import('./anthropic-sdk.js');
      providers.set('anthropic', await AnthropicSdkProvider.create());
    } catch (err) {
      console.warn(`Anthropic SDK provider unavailable: ${err.message}`);
    }
  }
  return providers;
}

/** Preferred default: PROVIDER env override, else the most capable live option. */
export function defaultProviderName(providers) {
  const forced = process.env.PROVIDER;
  if (forced && providers.has(forced)) return forced;
  if (providers.has('anthropic')) return 'anthropic';
  if (providers.has('claude-cli')) return 'claude-cli';
  return 'demo';
}
