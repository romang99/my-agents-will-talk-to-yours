// claude-cli.js — LLM driver that shells out to the local `claude` CLI
// (Claude Code), so the app runs on the owner's existing subscription with no
// API key. Same pattern as SyncMinds v0.1's ClaudeCLIProvider, ported to Node.
//
// Each call is a one-shot `claude -p` invocation with --output-format json.
// The system prompt is passed via --append-system-prompt; the user prompt via
// stdin. Transient failures (overload, momentary usage limits) are retried once.

import { spawn } from 'node:child_process';

const CALL_TIMEOUT_MS = 180_000;
const RETRY_DELAY_MS = 5_000;

export class ClaudeCliProvider {
  name = 'claude-cli';
  model = 'opus (via Claude Code CLI)';
  /** Models the judge stage may address through the CLI's --model aliases. */
  judgeModels = ['opus', 'sonnet', 'haiku'];

  async complete({ system, prompt, model }) {
    return claudeCliCall({ system, prompt, model });
  }
}

/**
 * `claude -p` invocation with a built-in retry — transient blips (exit 1 with
 * no output, momentary overloads) are absorbed here so EVERY caller gets the
 * same resilience: pipeline stages and the profile scout alike.
 * `allowedTools` (e.g. ['WebSearch','WebFetch']) with a higher `maxTurns` lets
 * the call research on the live web. Returns the final result text.
 */
export async function claudeCliCall({
  system,
  prompt,
  allowedTools = [],
  maxTurns = 1,
  timeoutMs = CALL_TIMEOUT_MS,
  model = 'opus',
}) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await claudeCliCallOnce({ system, prompt, allowedTools, maxTurns, timeoutMs, model });
    } catch (err) {
      lastErr = err;
      if (attempt === 1) {
        console.warn(`claude CLI call failed (${err.message}); retrying in ${RETRY_DELAY_MS / 1000}s`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastErr;
}

async function claudeCliCallOnce({ system, prompt, allowedTools, maxTurns, timeoutMs, model }) {
  const args = [
    '-p',
    '--output-format', 'json',
    '--model', model,
    '--max-turns', String(maxTurns),
  ];
  if (allowedTools.length) args.push('--allowedTools', allowedTools.join(','));
  if (system) args.push('--append-system-prompt', system);

  const stdout = await runProcess('claude', args, prompt, timeoutMs);
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`claude CLI returned non-JSON output: ${stdout.slice(0, 300)}`);
  }
  if (parsed.is_error) throw new Error(`claude CLI error: ${parsed.result ?? 'unknown'}`);
  return String(parsed.result ?? '').trim();
}

function runProcess(cmd, args, stdin, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude CLI call timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(out);
      // The CLI often reports errors as JSON on stdout with an empty stderr —
      // dig the real message out so failures are diagnosable.
      let detail = err.trim().slice(0, 300);
      if (!detail && out) {
        try {
          const j = JSON.parse(out);
          detail = String(j.result ?? j.error ?? '').slice(0, 300);
        } catch {
          detail = out.trim().slice(0, 300);
        }
      }
      reject(new Error(`claude CLI exited ${code}${detail ? `: ${detail}` : ' (no error output — possibly a transient overload or usage limit)'}`));
    });

    child.stdin.write(stdin);
    child.stdin.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
