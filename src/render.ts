/**
 * Render orchestration: compose segments, apply the configured separator, and
 * perform width-aware truncation on narrow terminals.
 *
 * Truncation strategy: build the full line, measure its *visible* length
 * (ANSI codes are ignored), and if it exceeds maxWidth, drop the lowest-priority
 * segments one at a time until it fits (or only the highest-priority segment
 * remains). This keeps the most important info on screen in tiny panes.
 */

import { truncateStyled, visibleLength } from './format.js';

import {
  modelSegment,
  contextSegment,
  rateSegment,
  gitSegment,
  costSegment,
} from './segments.js';

import type { Payload } from './types.js';
import type { GitInfo } from './types.js';
import type { Config } from './config.js';

/**
 * Segment priority (highest first). When space is tight we drop from the
 * bottom of this list.
 */
const PRIORITY: Array<'model' | 'context' | 'rate' | 'git' | 'cost'> = [
  'model',
  'context',
  'git',
  'rate',
  'cost',
];

interface BuiltSegment {
  key: (typeof PRIORITY)[number];
  text: string;
}

export function render(
  payload: Payload,
  git: GitInfo | null,
  cfg: Config,
  opts: { width?: number; now?: number } = {},
): string {
  const width = opts.width ?? detectWidth(cfg);

  const built: BuiltSegment[] = [
    { key: 'model' as const, text: modelSegment(payload) ?? '' },
    { key: 'context' as const, text: contextSegment(payload, cfg) ?? '' },
    { key: 'git' as const, text: gitSegment(git) ?? '' },
    { key: 'rate' as const, text: rateSegment(payload, cfg) ?? '' },
    { key: 'cost' as const, text: costSegment(payload) ?? '' },
  ].filter((s) => s.text.length > 0);

  if (built.length === 0) return '';

  // Order by priority (highest first) and drop lowest-priority segments one at a
  // time until the line fits the available width (or only the top segment remains).
  const ordered = built
    .slice()
    .sort((a, b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));

  let line = '';
  for (let i = 0; i < ordered.length; i++) {
    const candidate = applySeparators(ordered.slice(0, i + 1), cfg.separator);
    if (visibleLength(candidate) > width) break;
    line = candidate;
  }

  if (!line && ordered.length > 0) {
    // Even a single segment overflows; truncate it to fit.
    line = truncateStyled(ordered[0].text, Math.max(1, width - cfg.separator.length));
  }

  return line;
}

/** Join segments with the separator, inserting it between each. */
function applySeparators(segments: BuiltSegment[], sep: string): string {
  if (segments.length === 0) return '';
  let out = '';
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) out += sep;
    out += segments[i].text;
  }
  return out;
}

/** Detect available terminal width, falling back to config default. */
function detectWidth(cfg: Config): number {
  const cols = process.stdout.columns;
  if (cols && cols > 0) return Math.min(cols, cfg.maxWidth);
  const envCols = Number(process.env.COLUMNS);
  if (Number.isFinite(envCols) && envCols > 0) return Math.min(envCols, cfg.maxWidth);
  return cfg.maxWidth;
}
