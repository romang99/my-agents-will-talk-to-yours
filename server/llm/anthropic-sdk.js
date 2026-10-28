// anthropic-sdk.js — LLM driver using the official Anthropic SDK.
// Used when ANTHROPIC_API_KEY is set. The SDK is the project's only optional
// dependency; install it with `npm install @anthropic-ai/sdk` for this mode.

const MODEL = 'claude-opus-4-8';

export class AnthropicSdkProvider {
  name = 'anthropic';
  model = MODEL;
  /** Models the judge stage may address. Several Anthropic models are not
   * several independent judges (shared training) — a cross-vendor driver is
   * what would answer that question. */
  judgeModels = [MODEL, 'claude-sonnet-5', 'claude-haiku-4-5-20251001'];

  static async create() {
    let Anthropic;
    try {
      ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
    } catch {
      throw new Error(
        'The @anthropic-ai/sdk package is not installed. Run `npm install @anthropic-ai/sdk` to use the API-key provider.',
      );
    }
    const provider = new AnthropicSdkProvider();
    provider.client = new Anthropic();
    return provider;
  }

  // Sampling stays at the API default (temperature 1, required with adaptive
  // thinking) — repeated judge votes only form a distribution if sampling is
  // stochastic, which is also why the judge design leans on this provider.
  async complete({ system, prompt, maxTokens = 2000, model = MODEL }) {
    const stream = this.client.messages.stream({
      model,
      max_tokens: Math.max(maxTokens, 1024),
      thinking: { type: 'adaptive' },
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      throw new Error('The model declined this request (stop_reason: refusal).');
    }
    return message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  }
}
