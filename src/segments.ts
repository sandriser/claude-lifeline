/**
 * Individual statusline segments. Each returns a styled string or null; a null
 * result means "no data available" and the segment collapses cleanly.
 */

import {
  styles,
  progressBar,
  countdown,
  usd,
  defaultBarColor,
} from './format.js';

import { modelBadge } from './models.js';

import type { Payload } from './types.js';
import type { GitInfo } from './types.js';
import type { Config } from './config.js';

/**
 * 1) Model badge — clean short name, e.g. "Opus 4.6".
 * Collapses when no model info is present.
 */
export function modelSegment(payload: Payload): string | null {
  const badge = modelBadge(payload.model);
  if (!badge) return null;
  return styles.magenta(styles.bold(badge));
}

/**
 * 2) Context budget — progress bar + remaining %.
 * The bar fills to the remaining percentage (a "fuel gauge").
 * Collapses when no context data is present.
 */
export function contextSegment(
  payload: Payload,
  cfg: Pick<Config, 'barWidth'>,
): string | null {
  const ctx = payload.context_window;
  if (!ctx) return null;

  // Prefer remaining%; fall back to deriving it from used%.
  let remaining = ctx.remaining_percentage;
  if (remaining === undefined && ctx.used_percentage !== undefined) {
    remaining = 100 - ctx.used_percentage;
  }
  if (remaining === undefined) return null;

  const bar = progressBar(remaining, cfg.barWidth, defaultBarColor);
  const pctText = `${Math.round(remaining)}%`;
  // Color the percentage to match the bar's urgency.
  const colored = defaultBarColor(remaining)(pctText);
  return `${bar} ${colored}`;
}

/**
 * 3) Usage & reset timers — 5h / 7d rate-limit windows.
 * Shows usage % and optional countdown to reset.
 * Collapses when no rate_limits are present.
 */
export function rateSegment(
  payload: Payload,
  cfg: Pick<Config, 'showResetCountdown' | 'showUsagePct'>,
): string | null {
  const rl = payload.rate_limits;
  if (!rl) return null;

  const parts: string[] = [];

  const five = rl.five_hour;
  if (five) {
    const s = windowSegment('5h', five, cfg);
    if (s) parts.push(s);
  }

  const seven = rl.seven_day;
  if (seven) {
    const s = windowSegment('7d', seven, cfg);
    if (s) parts.push(s);
  }

  if (parts.length === 0) return null;
  return styles.cyan(parts.join(' '));
}

function windowSegment(
  label: string,
  window: { used_percentage?: number; resets_at?: number },
  cfg: Pick<Config, 'showResetCountdown' | 'showUsagePct'>,
): string | null {
  const bits: string[] = [];
  if (cfg.showUsagePct && window.used_percentage !== undefined) {
    bits.push(`${Math.round(window.used_percentage)}%`);
  }
  if (cfg.showResetCountdown && window.resets_at !== undefined) {
    const cd = countdown(window.resets_at);
    if (cd) bits.push(cd);
  }
  if (bits.length === 0) return null;
  return `${styles.dim(label)} ${bits.join(' ')}`;
}

/**
 * 4) Git branch + dirty status.
 * Branch name; "+" if staged changes, "*" if working tree dirty.
 * Collapses when git is unavailable or no branch is known.
 */
export function gitSegment(git: GitInfo | null): string | null {
  if (!git) return null;
  if (!git.branch && !git.detached) return null;

  let label = git.branch;
  if (git.detached && !label) label = 'detached';

  const tags: string[] = [];
  if (git.staged) tags.push(styles.yellow('+'));
  if (git.dirty) tags.push(styles.yellow('*'));

  if (label) {
    const branchPart = git.detached ? styles.dim(label) : styles.green(label);
    return tags.length ? `${branchPart} ${tags.join(' ')}` : branchPart;
  }
  return tags.length ? tags.join(' ') : null;
}

/**
 * 5) Session cost — accumulated USD.
 * Collapses when no cost data is present.
 */
export function costSegment(payload: Payload): string | null {
  const cost = payload.cost;
  if (!cost || cost.total_cost_usd === undefined) return null;
  return styles.gold(usd(cost.total_cost_usd));
}
