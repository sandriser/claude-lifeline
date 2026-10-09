/**
 * Optional local configuration.
 *
 * claude-lifeline works with zero config. If a config file exists it is loaded
 * defensively — any parse error, missing field, or bad type is ignored and the
 * built-in defaults are used. The config file is NEVER required to run.
 *
 * Resolution order (first found wins):
 *   1. $CLAUDE_LIFELINE_CONFIG
 *   2. <cwd>/.claude-lifeline.json
 *   3. $HOME/.claude-lifeline.json
 */

import * as fs from 'fs';

export interface Config {
  /** Visible width of the context progress bar (blocks). */
  barWidth: number;
  /** Maximum visible statusline width before segments are dropped. */
  maxWidth: number;
  /** Separator string between segments. */
  separator: string;
  /** Show the rate-limit reset countdown (e.g. "5h 2h15m"). */
  showResetCountdown: boolean;
  /** Show the 5h/7d usage percentages. */
  showUsagePct: boolean;
  /** Enable the git subprocess (branch + dirty). Set false to skip git. */
  git: boolean;
  /** Default terminal width assumed when COLUMNS is unset. */
  defaultColumns: number;
}

export const DEFAULT_CONFIG: Config = {
  barWidth: 10,
  maxWidth: 120,
  separator: ' › ',
  showResetCountdown: true,
  showUsagePct: true,
  git: true,
  defaultColumns: 120,
};

function readJsonFile(path: string): unknown {
  try {
    const raw = fs.readFileSync(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Load config merged over defaults. Never throws.
 * `cwd` is used for filesystem resolution (main thread only).
 */
export function loadConfig(cwd: string = process.cwd()): Config {
  const cfg: Config = { ...DEFAULT_CONFIG };

  const candidates: string[] = [];
  if (process.env.CLAUDE_LIFELINE_CONFIG) candidates.push(process.env.CLAUDE_LIFELINE_CONFIG);
  candidates.push(`${cwd}/.claude-lifeline.json`);
  if (process.env.HOME) candidates.push(`${process.env.HOME}/.claude-lifeline.json`);

  for (const path of candidates) {
    const parsed = readJsonFile(path);
    if (!parsed || typeof parsed !== 'object') continue;
    const p = parsed as Record<string, unknown>;

    if (typeof p.barWidth === 'number' && p.barWidth >= 1 && p.barWidth <= 40) {
      cfg.barWidth = Math.round(p.barWidth);
    }
    if (typeof p.maxWidth === 'number' && p.maxWidth >= 20) {
      cfg.maxWidth = Math.round(p.maxWidth);
    }
    if (typeof p.separator === 'string' && p.separator.trim()) {
      cfg.separator = p.separator;
    }
    if (typeof p.showResetCountdown === 'boolean') {
      cfg.showResetCountdown = p.showResetCountdown;
    }
    if (typeof p.showUsagePct === 'boolean') {
      cfg.showUsagePct = p.showUsagePct;
    }
    if (typeof p.git === 'boolean') {
      cfg.git = p.git;
    }
    if (typeof p.defaultColumns === 'number' && p.defaultColumns >= 20) {
      cfg.defaultColumns = Math.round(p.defaultColumns);
    }
    break; // first valid file wins
  }

  return cfg;
}
