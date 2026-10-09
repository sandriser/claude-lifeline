import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePayload, toNumber, toStr } from '../dist/parse.js';

test('toNumber coerces numbers and numeric strings', () => {
  assert.equal(toNumber(5), 5);
  assert.equal(toNumber('42'), 42);
  assert.equal(toNumber('3.14'), 3.14);
  assert.equal(toNumber('  7 '), 7);
  assert.equal(toNumber('abc'), undefined);
  assert.equal(toNumber(''), undefined);
  assert.equal(toNumber(null), undefined);
  assert.equal(toNumber(NaN), undefined);
  assert.equal(toNumber(Infinity), undefined);
});

test('toStr trims and rejects blanks', () => {
  assert.equal(toStr('  main  '), 'main');
  assert.equal(toStr(''), undefined);
  assert.equal(toStr('   '), undefined);
  assert.equal(toStr(123), undefined);
  assert.equal(toStr(null), undefined);
});

test('empty / whitespace input yields empty payload', () => {
  assert.deepEqual(parsePayload(''), {});
  assert.deepEqual(parsePayload('   \n\t'), {});
  assert.deepEqual(parsePayload(null), {});
  assert.deepEqual(parsePayload(undefined), {});
});

test('invalid JSON yields empty payload (never throws)', () => {
  assert.deepEqual(parsePayload('not json {{{'), {});
  assert.deepEqual(parsePayload('{'), {});
  assert.deepEqual(parsePayload('[1,2,3'), {});
});

test('full payload parses into typed structure', () => {
  const raw = JSON.stringify({
    cwd: '/tmp/proj',
    session_id: 'abc123',
    model: { id: 'claude-opus-4-6', display_name: 'Opus' },
    workspace: { current_dir: '/tmp/proj', project_dir: '/tmp/proj' },
    context_window: {
      used_percentage: 28,
      remaining_percentage: 72,
      context_window_size: 200000,
    },
    cost: { total_cost_usd: 0.1824, total_duration_ms: 45000 },
    rate_limits: {
      five_hour: { used_percentage: 41.2, resets_at: 1760000000 },
      seven_day: { used_percentage: 18.5, resets_at: 1760500000 },
    },
  });
  const p = parsePayload(raw);
  assert.equal(p.cwd, '/tmp/proj');
  assert.equal(p.model?.display_name, 'Opus');
  assert.equal(p.context_window?.remaining_percentage, 72);
  assert.equal(p.cost?.total_cost_usd, 0.1824);
  assert.equal(p.rate_limits?.five_hour?.used_percentage, 41.2);
  assert.equal(p.rate_limits?.seven_day?.resets_at, 1760500000);
});

test('null fields collapse to undefined (graceful)', () => {
  const p = parsePayload(
    JSON.stringify({
      model: null,
      context_window: null,
      cost: null,
      rate_limits: null,
    }),
  );
  assert.equal(p.model, undefined);
  assert.equal(p.context_window, undefined);
  assert.equal(p.cost, undefined);
  assert.equal(p.rate_limits, undefined);
});

test('wrong-typed keys are ignored', () => {
  const p = parsePayload(
    JSON.stringify({
      model: 'not-an-object',
      context_window: { used_percentage: 'lots' },
      cost: { total_cost_usd: 'expensive' },
    }),
  );
  assert.equal(p.model, undefined);
  assert.equal(p.context_window, undefined);
  assert.equal(p.cost, undefined);
});

test('derived remaining from used when only used present', () => {
  const p = parsePayload(JSON.stringify({ context_window: { used_percentage: 33 } }));
  assert.equal(p.context_window?.used_percentage, 33);
  assert.equal(p.context_window?.remaining_percentage, undefined);
});

test('completely useless object yields empty payload', () => {
  assert.deepEqual(parsePayload(JSON.stringify({ foo: 'bar', baz: 1 })), {});
});
