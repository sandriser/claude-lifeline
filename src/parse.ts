/**
 * Defensive JSON parsing for the Claude Code statusline payload.
 *
 * The single most important property of a statusline is that it must NEVER throw.
 * Claude Code calls the statusline on every refresh; if our script crashes, the
 * prompt line disappears. So parsing is wrapped in the widest possible net:
 *   - empty / whitespace input            -> empty payload
 *   - invalid JSON                        -> empty payload
 *   - any missing / null / wrong-typed key -> that key is simply absent
 *
 * Nothing here rejects or throws; it only ever produces a well-formed Payload.
 */

import type { Payload } from './types.js';

/** Coerce an unknown value to a finite number, or return undefined. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Coerce an unknown value to a trimmed string, or return undefined. */
export function toStr(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}

function parseModel(raw: unknown): Payload['model'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const id = toStr(obj.id);
  const name = toStr(obj.display_name);
  if (id === undefined && name === undefined) return undefined;
  return { id, display_name: name };
}

function parseContext(raw: unknown): Payload['context_window'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const used = toNumber(obj.used_percentage);
  const remaining = toNumber(obj.remaining_percentage);
  const size = toNumber(obj.context_window_size);
  if (used === undefined && remaining === undefined && size === undefined) {
    return undefined;
  }
  return {
    used_percentage: used,
    remaining_percentage: remaining,
    context_window_size: size,
    total_input_tokens: toNumber(obj.total_input_tokens),
    total_output_tokens: toNumber(obj.total_output_tokens),
    exceeds_200k_tokens:
      typeof obj.exceeds_200k_tokens === 'boolean'
        ? obj.exceeds_200k_tokens
        : undefined,
  };
}

function parseCost(raw: unknown): Payload['cost'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const cost = toNumber(obj.total_cost_usd);
  const duration = toNumber(obj.total_duration_ms);
  if (cost === undefined && duration === undefined) return undefined;
  return {
    total_cost_usd: cost,
    total_duration_ms: duration,
    total_lines_added: toNumber(obj.total_lines_added),
    total_lines_removed: toNumber(obj.total_lines_removed),
  };
}

function parseWindow(raw: unknown): {
  used_percentage?: number;
  resets_at?: number;
} | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const used = toNumber(obj.used_percentage);
  const resets = toNumber(obj.resets_at);
  if (used === undefined && resets === undefined) return undefined;
  return { used_percentage: used, resets_at: resets };
}

function parseRateLimits(raw: unknown): Payload['rate_limits'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const five = parseWindow(obj.five_hour);
  const seven = parseWindow(obj.seven_day);
  if (five === undefined && seven === undefined) return undefined;
  return { five_hour: five, seven_day: seven };
}

function parseWorkspace(raw: unknown): Payload['workspace'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const current = toStr(obj.current_dir);
  const project = toStr(obj.project_dir);
  if (current === undefined && project === undefined) return undefined;
  return { current_dir: current, project_dir: project };
}

/**
 * Parse raw stdin text into a Payload. Never throws.
 * Empty or unparseable input yields an empty payload (all widgets collapse).
 */
export function parsePayload(raw: string | null | undefined): Payload {
  if (!raw || raw.trim() === '') return {};
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!json || typeof json !== 'object') return {};
  const obj = json as Record<string, unknown>;

  const cwd = toStr(obj.cwd);
  const sessionId = toStr(obj.session_id);
  const model = parseModel(obj.model);
  const workspace = parseWorkspace(obj.workspace);
  const context = parseContext(obj.context_window);
  const cost = parseCost(obj.cost);
  const rateLimits = parseRateLimits(obj.rate_limits);

  // If literally nothing useful survived, return empty so the line collapses.
  if (
    cwd === undefined &&
    sessionId === undefined &&
    model === undefined &&
    workspace === undefined &&
    context === undefined &&
    cost === undefined &&
    rateLimits === undefined
  ) {
    return {};
  }

  return { cwd, session_id: sessionId, model, workspace, context_window: context, cost, rate_limits: rateLimits };
}
