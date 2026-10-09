import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  progressBar,
  countdown,
  usd,
  truncateStyled,
  visibleLength,
  stripAnsi,
  join,
  sgr,
} from '../dist/format.js';

test('progressBar fills proportionally and clamps', () => {
  assert.equal(stripAnsi(progressBar(0, 10)), '[░░░░░░░░░░]');
  assert.equal(stripAnsi(progressBar(100, 10)), '[██████████]');
  assert.equal(stripAnsi(progressBar(50, 10)), '[█████░░░░░]');
  assert.equal(stripAnsi(progressBar(150, 10)), '[██████████]'); // clamps high
  assert.equal(stripAnsi(progressBar(-20, 10)), '[░░░░░░░░░░]'); // clamps low
});

test('progressBar respects custom width', () => {
  assert.equal(stripAnsi(progressBar(50, 4)), '[██░░]');
  assert.equal(stripAnsi(progressBar(25, 8)), '[██░░░░░░]');
});

test('progressBar output is wrapped in color codes when filled', () => {
  const bar = progressBar(50, 10);
  assert.match(bar, /\x1b\[/, 'filled blocks carry ANSI');
  assert.ok(bar.startsWith('[') && bar.endsWith(']'));
});

test('progressBar colors transition green->yellow->red', () => {
  assert.ok(progressBar(90, 10).includes('\x1b[38;2;140;233;154m'), 'healthy => green');
  assert.ok(progressBar(5, 10).includes('\x1b[38;2;255;107;107m'), 'near capacity => red');
});

test('countdown formats d/h/m and rejects past times', () => {
  const now = Date.now();
  assert.equal(countdown(now / 1000 + 900), '15m');
  assert.equal(countdown(now / 1000 + 3600), '1h0m');
  assert.equal(countdown(now / 1000 + 3600 * 5 + 1800), '5h30m');
  assert.equal(countdown(now / 1000 + 86400 * 2 + 3600), '2d1h');
  assert.equal(countdown(now / 1000 - 100), null); // past
  assert.equal(countdown(Number.NaN), null);
});

test('usd formats to two decimals', () => {
  assert.equal(usd(0.1824), '$0.18');
  assert.equal(usd(0), '$0.00');
  assert.equal(usd(1.5), '$1.50');
  assert.equal(usd(Number.NaN), '$0.00');
});

test('visibleLength and stripAnsi ignore escape codes', () => {
  const styled = sgr('1', 'hello');
  assert.equal(visibleLength(styled), 5);
  assert.equal(stripAnsi(styled), 'hello');
  assert.equal(visibleLength('plain'), 5);
});

test('truncateStyled truncates by visible length with ellipsis', () => {
  const styled = sgr('1', 'Opus 4.6'); // 8 visible chars
  assert.equal(truncateStyled(styled, 10), styled); // fits
  const short = truncateStyled(styled, 4);
  assert.equal(visibleLength(short), 4);
  assert.ok(short.endsWith('…'));
  assert.equal(truncateStyled(styled, 1), 'O');
  assert.equal(truncateStyled(styled, 0), '');
});

test('truncateStyled keeps a balanced reset before the ellipsis', () => {
  const styled = sgr('1', sgr('38;2;176;123;255', 'Opus'));
  const short = truncateStyled(styled, 3);
  assert.match(short, /\x1b\[0m/); // has a reset
  assert.ok(short.replace('…', '').endsWith('\x1b[0m'), 'reset precedes ellipsis');
  assert.equal(visibleLength(short), 3);
});

test('join filters nulls/empties and inserts separator', () => {
  assert.equal(stripAnsi(join(['a', null, '', 'b'])), 'a › b');
  assert.equal(join([null, undefined, '']), '');
  assert.equal(join(['only']), 'only');
});
