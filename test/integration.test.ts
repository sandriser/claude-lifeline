import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// End-to-end: spawn the real compiled executable (dist/index.js) exactly as
// Claude Code does — pipe JSON on stdin, read ANSI-colored stdout.
const HERE = fileURLToPath(new URL('.', import.meta.url));
const BIN = join(HERE, '..', 'dist', 'index.js');

function run(stdin: string, env: NodeJS.ProcessEnv = {}): string {
  const res = spawnSync('node', [BIN], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) {
    throw new Error(`exit ${res.status}: ${res.stderr}`);
  }
  return res.stdout ?? '';
}

const FULL = {
  cwd: process.cwd(),
  model: { id: 'claude-opus-4-6', display_name: 'Opus' },
  workspace: { current_dir: process.cwd() },
  context_window: { used_percentage: 28, remaining_percentage: 72, context_window_size: 200000 },
  cost: { total_cost_usd: 0.1824 },
  rate_limits: {
    five_hour: { used_percentage: 41.2, resets_at: Math.floor(Date.now() / 1000) + 7200 },
    seven_day: { used_percentage: 18.5, resets_at: Math.floor(Date.now() / 1000) + 604800 },
  },
};

test('full payload renders a colored line with all segments', () => {
  const out = run(JSON.stringify(FULL));
  assert.ok(out.length > 0);
  assert.match(out, /\x1b\[/, 'contains ANSI codes');
  assert.match(out, /Opus/, 'model badge');
  assert.match(out, /72%/, 'context remaining');
  assert.match(out, /\[.+]/, 'progress bar');
  assert.match(out, /\$0\.18/, 'cost');
  assert.ok(!/\bnull\b/.test(out), 'no null tokens');
  assert.ok(!/undefined/.test(out), 'no undefined tokens');
});

test('malformed input never crashes (empty output)', () => {
  const out = run('{ this is not valid json');
  assert.equal(out, '');
});

test('empty input never crashes', () => {
  const out = run('');
  assert.equal(out, '');
});

test('minimal payload renders just the model', () => {
  const out = run(JSON.stringify({ model: { id: 'claude-haiku-4-5' } }));
  assert.match(out, /Haiku 4\.5/);
  assert.ok(!/\bnull\b/.test(out));
});

test('runs under a narrow terminal width (COLUMNS)', () => {
  const out = run(JSON.stringify(FULL), { COLUMNS: '20' });
  // Must still be valid output and never crash.
  assert.ok(typeof out === 'string');
});

test('honors a custom config via CLAUDE_LIFELINE_CONFIG', () => {
  const cfg = join(HERE, '..', 'test', '_fixture_config.json');
  const out = run(JSON.stringify({ model: { id: 'claude-opus-4-6' } }), {
    CLAUDE_LIFELINE_CONFIG: cfg,
  });
  assert.match(out, /Opus 4\.6/);
});
