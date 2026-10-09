import { test } from 'node:test';
import assert from 'node:assert/strict';

import { render } from '../dist/render.js';
import { DEFAULT_CONFIG } from '../dist/config.js';
import { stripAnsi } from '../dist/format.js';
import type { Payload } from '../dist/types.js';
import type { GitInfo } from '../dist/types.js';

const FULL: Payload = {
  cwd: '/tmp/proj',
  model: { id: 'claude-opus-4-6', display_name: 'Opus' },
  workspace: { current_dir: '/tmp/proj' },
  context_window: { used_percentage: 28, remaining_percentage: 72, context_window_size: 200000 },
  cost: { total_cost_usd: 0.1824 },
  rate_limits: {
    five_hour: { used_percentage: 41.2, resets_at: Date.now() / 1000 + 7200 },
    seven_day: { used_percentage: 18.5, resets_at: Date.now() / 1000 + 604800 },
  },
};

const GIT: GitInfo = { branch: 'main', dirty: false, staged: false, detached: false };
const GIT_DIRTY: GitInfo = { branch: 'main', dirty: true, staged: true, detached: false };

test('render composes all segments on a full payload', () => {
  const out = stripAnsi(render(FULL, GIT, DEFAULT_CONFIG));
  assert.ok(out.includes('Opus'), 'model');
  assert.ok(out.includes('72%'), 'context remaining');
  assert.ok(out.includes('main'), 'git branch');
  assert.ok(out.includes('5h'), 'rate 5h');
  assert.ok(out.includes('$0.18'), 'cost');
});

test('missing segments collapse gracefully', () => {
  const out = stripAnsi(render({ model: { id: 'claude-haiku-4-5' } }, null, DEFAULT_CONFIG));
  assert.ok(out.includes('Haiku 4.5'));
  assert.ok(!out.includes('null'));
  assert.ok(!out.includes('undefined'));
});

test('empty payload yields empty string', () => {
  assert.equal(render({}, null, DEFAULT_CONFIG), '');
  assert.equal(render({ cwd: '/tmp' }, null, DEFAULT_CONFIG), '');
});

test('narrow width drops lowest-priority segments', () => {
  const wide = stripAnsi(render(FULL, GIT, DEFAULT_CONFIG, { width: 200 }));
  const narrow = stripAnsi(render(FULL, GIT, DEFAULT_CONFIG, { width: 30 }));
  assert.ok(wide.includes('$0.18'));
  assert.ok(!narrow.includes('$0.18'), 'cost dropped on narrow');
  assert.ok(!narrow.includes('5h'), 'rate dropped on narrow');
  // model + context + git should survive
  assert.ok(narrow.includes('Opus'));
  assert.ok(narrow.includes('main'));
});

test('extremely narrow width truncates the single surviving segment', () => {
  const out = render(FULL, GIT, DEFAULT_CONFIG, { width: 4 });
  assert.ok(stripAnsi(out).length <= 4);
});

test('git dirty and staged indicators appear', () => {
  const out = stripAnsi(render({ model: { id: 'claude-opus-4-6' } }, GIT_DIRTY, DEFAULT_CONFIG));
  assert.ok(out.includes('main'));
  assert.ok(out.includes('+'));
  assert.ok(out.includes('*'));
});

test('detached git renders a label', () => {
  const out = stripAnsi(
    render({ model: { id: 'claude-opus-4-6' } }, { branch: '', dirty: false, staged: false, detached: true }, DEFAULT_CONFIG),
  );
  assert.ok(out.includes('detached'));
});

test('output never contains the literal tokens null/undefined', () => {
  const out = stripAnsi(render(FULL, GIT_DIRTY, DEFAULT_CONFIG));
  assert.ok(!/\bnull\b/.test(out));
  assert.ok(!/undefined/.test(out));
});

test('context remaining is derived from used when absent', () => {
  const p: Payload = { model: { id: 'claude-opus-4-6' }, context_window: { used_percentage: 40 } };
  const out = stripAnsi(render(p, null, DEFAULT_CONFIG));
  assert.ok(out.includes('60%'), 'should show 60% remaining');
});
