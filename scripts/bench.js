#!/usr/bin/env node
/**
 * claude-lifeline latency benchmark.
 *
 * Measures the cost of the statusline render pipeline so the "<10ms" promise is
 * empirically verifiable. Two views are reported:
 *
 *   1. Pure render path — parsePayload() + render() in a tight loop. This is the
 *      hot path Claude Code invokes on every refresh, with git disabled so we
 *      isolate the pure formatting cost.
 *   2. End-to-end — the full pipeline (including one synchronous git subprocess)
 *      for a single representative payload.
 *
 * Usage:
 *   npm run bench
 *
 * No network access, no LLM calls, no side effects — it only times local work.
 */

import { performance } from 'node:perf_hooks';

import { parsePayload } from '../dist/parse.js';
import { render } from '../dist/render.js';
import { loadConfig } from '../dist/config.js';
import { fetchGit } from '../dist/git.js';

const ITERATIONS = 20000;
const SAMPLES = 50;

/** A representative full payload spanning every segment. */
function samplePayload() {
  return {
    cwd: process.cwd(),
    model: { id: 'claude-opus-4-6', display_name: 'Opus' },
    workspace: { current_dir: process.cwd() },
    context_window: {
      used_percentage: 28,
      remaining_percentage: 72,
      context_window_size: 200000,
    },
    cost: { total_cost_usd: 0.1824 },
    rate_limits: {
      five_hour: { used_percentage: 41.2, resets_at: Math.floor(Date.now() / 1000) + 7200 },
      seven_day: { used_percentage: 18.5, resets_at: Math.floor(Date.now() / 1000) + 604800 },
    },
  };
}

/** Collect N per-iteration samples (ms) for a synchronous callback. */
function sampleHot(fn, n = SAMPLES) {
  for (let i = 0; i < 1000; i++) fn(); // warm up so JIT has optimized the path
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return samples;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(label, samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const ms = (x) => `${x.toFixed(3)}ms`;
  console.log(`  ${label}`);
  console.log(`    count   : ${sorted.length}`);
  console.log(`    mean    : ${ms(mean)}`);
  console.log(`    median  : ${ms(percentile(sorted, 50))}`);
  console.log(`    p95     : ${ms(percentile(sorted, 95))}`);
  console.log(`    p99     : ${ms(percentile(sorted, 99))}`);
  console.log(`    min/max : ${ms(sorted[0])} / ${ms(sorted[sorted.length - 1])}`);
}

function main() {
  const cfg = loadConfig(process.cwd());
  const payload = samplePayload();

  console.log('claude-lifeline latency benchmark');
  console.log(`  iterations: ${ITERATIONS.toLocaleString()} (warm-up 1000)`);
  console.log('');

  // 1. Pure render path: parse + render (git disabled) — the hot loop.
  console.log('Pure render path (parsePayload + render, git off):');
  summarize('  per-iteration', sampleHot(() => {
    const p = parsePayload(JSON.stringify(payload));
    render(p, null, cfg);
  }));
  console.log('');

  // 2. render-only (parse already done) — pure formatting cost.
  console.log('Render-only (parse once, render N):');
  const parsed = parsePayload(JSON.stringify(payload));
  summarize('  per-render', sampleHot(() => render(parsed, null, cfg)));
  console.log('');

  // 3. End-to-end including one git subprocess (fetchGit is synchronous).
  console.log('End-to-end (parse + git + render):');
  const e2e = sampleHot(() => {
    const git = fetchGit(payload);
    render(parsed, git, cfg);
  });
  summarize('  per-run', e2e);
  console.log('');

  const med = percentile(
    sampleHot(() => {
      const p = parsePayload(JSON.stringify(payload));
      render(p, null, cfg);
    }),
    50,
  );
  console.log(
    med <= 0.01
      ? `  ✓ median ${med.toFixed(3)}ms — under the 10ms target.`
      : `  ✗ median ${med.toFixed(3)}ms — above the 10ms target; investigate.`,
  );
}

main();
