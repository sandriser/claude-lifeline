import { test } from 'node:test';
import assert from 'node:assert/strict';

import { modelBadge } from '../dist/models.js';

test('prefers display_name when present', () => {
  assert.equal(modelBadge({ display_name: 'Opus 4.6 (custom)' }), 'Opus 4.6 (custom)');
  assert.equal(modelBadge({ id: 'claude-opus-4-6', display_name: 'Sonnet' }), 'Sonnet');
});

test('maps known model ids to friendly badges', () => {
  assert.equal(modelBadge({ id: 'claude-opus-4-6' }), 'Opus 4.6');
  assert.equal(modelBadge({ id: 'claude-sonnet-4-5' }), 'Sonnet 4.5');
  assert.equal(modelBadge({ id: 'claude-haiku-4-5' }), 'Haiku 4.5');
  assert.equal(modelBadge({ id: 'claude-opus-4' }), 'Opus 4');
  assert.equal(modelBadge({ id: 'claude-sonnet-4-0' }), 'Sonnet 4');
});

test('derives family + version from unknown ids', () => {
  assert.equal(modelBadge({ id: 'claude-opus-4-2' }), 'Opus 4.2');
  assert.equal(modelBadge({ id: 'claude-sonnet-4-9' }), 'Sonnet 4.9');
});

test('handles ids without a numeric version', () => {
  assert.equal(modelBadge({ id: 'claude-opus' }), 'Opus');
});

test('falls back to cleaned id for unrecognized families', () => {
  assert.equal(modelBadge({ id: 'claude-futuremodel-9' }), 'futuremodel-9');
});

test('handles null / undefined / empty gracefully', () => {
  assert.equal(modelBadge(null), undefined);
  assert.equal(modelBadge(undefined), undefined);
  assert.equal(modelBadge({}), undefined);
  assert.equal(modelBadge({ id: '   ', display_name: '' }), undefined);
});
