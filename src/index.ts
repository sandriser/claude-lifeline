#!/usr/bin/env node
/**
 * claude-lifeline — ultra-fast, zero-overhead statusline for the Claude Code CLI.
 *
 * Reads the stdin JSON payload, renders model / context / rate-limit / git / cost
 * segments, and writes a single ANSI-colored line to stdout. Never throws: any
 * missing key or malformed input collapses the affected widget rather than
 * crashing the statusline.
 *
 * Usage:
 *   <some json> | claude-lifeline
 */

import * as fs from 'fs';

import { parsePayload } from './parse.js';
import { loadConfig } from './config.js';
import { fetchGit } from './git.js';
import { render } from './render.js';
import type { Payload } from './types.js';

async function main(): Promise<void> {
  // 1. Read stdin synchronously (fast, no event-loop overhead).
  let raw: string;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    // No stdin available — emit nothing rather than crash.
    return;
  }

  // 2. Defensive parse (never throws).
  const payload: Payload = parsePayload(raw);

  // No usable payload (empty / malformed input) — emit nothing.
  // A statusline with no session context should render nothing rather than a
  // lone git branch resolved from process.cwd(); Claude Code sends a real
  // payload on every meaningful refresh.
  if (Object.keys(payload).length === 0) {
    return;
  }

  // 3. Optional config (never throws).
  const cwd = payload.workspace?.current_dir || payload.cwd || process.cwd();
  const cfg = loadConfig(cwd);

  // 4. Git info via a single guarded subprocess (skipped when disabled).
  const git = cfg.git ? await fetchGit(payload) : null;

  // 5. Render and write.
  const out = render(payload, git, cfg);
  if (out.length > 0) {
    process.stdout.write(out);
  }
}

// Top-level guard: a statusline must never crash the prompt.
main().catch(() => {
  /* swallow — emit nothing */
});
