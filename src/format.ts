/**
 * Formatting primitives: ANSI palette, progress bars, countdown timers,
 * currency and width-aware truncation.
 *
 * All output uses standard SGR escape codes. We prefer semantic 8-color codes
 * for maximum terminal compatibility, but expose a truecolor helper for the
 * context bar gradient. Every helper is pure and side-effect free.
 */

const ESC = '\x1b[';
const RESET = '\x1b[0m';

/** Wrap text in a single SGR code and auto-reset. */
export function sgr(code: string | number, text: string): string {
  return `${ESC}${code}m${text}${RESET}`;
}

export const styles = {
  reset: RESET,
  // Semantic palette
  magenta: (t: string) => sgr('38;2;176;123;255', t), // #b07bff
  cyan: (t: string) => sgr('38;2;126;203;255', t), // #7ecbff
  green: (t: string) => sgr('38;2;140;233;154', t), // #8ce99a
  yellow: (t: string) => sgr('38;2;255;212;121', t), // #ffd479
  red: (t: string) => sgr('38;2;255;107;107', t), // #ff6b6b
  gold: (t: string) => sgr('38;2;255;199;115', t), // #ffc773
  dim: (t: string) => sgr('2;38;2;140;145;160', t), // dim slate
  bold: (t: string) => sgr('1', t),
};

/** 24-bit truecolor wrap. */
export function rgb(r: number, g: number, b: number, text: string): string {
  return `${ESC}38;2;${r};${g};${b}m${text}${RESET}`;
}

export const SEP = styles.dim(' › ');

/**
 * Compact block progress bar, e.g. "[████░░░]".
 * `pct` is the value the bar represents (0-100). Blocks are clamped to [0,width].
 * Filled blocks are colored by urgency; empty blocks are left as plain
 * half-blocks (render as light gray by default in most terminals).
 */
export function progressBar(
  pct: number,
  width = 10,
  colorFn: (pct: number) => (t: string) => string = defaultBarColor,
): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  const full = '█'.repeat(Math.max(0, Math.min(width, filled)));
  const empty = '░'.repeat(width - filled);
  const colored = colorFn(clamped)(full);
  return `[${colored}${empty}]`;
}

/** Green (plenty) -> yellow (tight) -> red (near capacity). */
export function defaultBarColor(pct: number): (t: string) => string {
  if (pct >= 75) return styles.green;
  if (pct >= 45) return styles.yellow;
  return styles.red;
}

/**
 * Human countdown to a unix-epoch reset time.
 * e.g. "2h15m", "6d3h", "18m". Returns null when the time is unknown/past.
 */
export function countdown(unixSeconds: number, nowMs: number = Date.now()): string | null {
  const nowSec = nowMs / 1000;
  const diff = unixSeconds - nowSec;
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${mins}m`;
  if (mins > 0) return `${mins}m`;
  return '<1m';
}

/** Format a USD amount, e.g. 0.182 -> "$0.18". */
export function usd(amount: number): string {
  if (!Number.isFinite(amount)) return '$0.00';
  return `$${amount.toFixed(2)}`;
}

/** Strip ANSI escape sequences to get the visible (display) length. */
export function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/** Strip all ANSI escape sequences. */
export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Truncate to a maximum visible length, appending an ellipsis when needed.
 * Operates on already-styled text but counts only visible characters.
 */
export function truncateStyled(styled: string, max: number): string {
  if (max <= 0) return '';
  if (visibleLength(styled) <= max) return styled;
  if (max === 1) return stripAnsi(styled).slice(0, 1);
  // Walk visible chars, keeping a balanced set of escape codes.
  const codeRe = /\x1b\[[0-9;]*m/g;
  let out = '';
  let visible = 0;
  for (let i = 0; i < styled.length; i++) {
    const ch = styled[i];
    if (ch === '\x1b') {
      const m = codeRe.exec(styled);
      if (m && m.index === i) {
        out += m[0];
        i = codeRe.lastIndex - 1;
        continue;
      }
    }
    if (visible >= max - 1) break;
    out += ch;
    visible++;
  }
  // Ensure a trailing reset even if the last code wasn't a reset.
  if (!/\x1b\[0m$/.test(out)) out += RESET;
  return out + '…';
}

/** Join non-empty segments with the separator, tolerating nulls. */
export function join(segments: Array<string | null | undefined>): string {
  const parts = segments.filter((s): s is string => typeof s === 'string' && s.length > 0);
  if (parts.length === 0) return '';
  return parts.join(SEP);
}
