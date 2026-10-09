/**
 * Typed view of the Claude Code statusline stdin payload.
 *
 * Source of truth: the official Claude Code statusline JSON schema. Only the
 * fields claude-lifeline consumes are modeled here. Every field is optional and
 * may be `null` at runtime; the parser normalizes missing/null/wrong-typed keys
 * to `undefined`, so the consumer-facing type uses `| undefined`. Nothing here
 * ever throws.
 *
 * https://code.claude.com/docs/en/statusline
 */

export interface ModelField {
  id?: string | undefined;
  display_name?: string | undefined;
}

export interface ContextWindow {
  used_percentage?: number | undefined;
  remaining_percentage?: number | undefined;
  context_window_size?: number | undefined;
  total_input_tokens?: number | undefined;
  total_output_tokens?: number | undefined;
  exceeds_200k_tokens?: boolean | undefined;
}

export interface CostField {
  total_cost_usd?: number | undefined;
  total_duration_ms?: number | undefined;
  total_lines_added?: number | undefined;
  total_lines_removed?: number | undefined;
}

export interface RateLimitWindow {
  used_percentage?: number | undefined;
  /** Unix epoch seconds when the window resets. */
  resets_at?: number | undefined;
}

export interface RateLimits {
  five_hour?: RateLimitWindow | undefined;
  seven_day?: RateLimitWindow | undefined;
}

export interface Workspace {
  current_dir?: string | undefined;
  project_dir?: string | undefined;
}

export interface GitInfo {
  /** Short HEAD ref, e.g. "main". Empty string means unknown. */
  branch: string;
  /** True if the working tree has unstaged/modified content. */
  dirty: boolean;
  /** True if there are staged changes. */
  staged: boolean;
  /** True when in a detached HEAD state. */
  detached: boolean;
}

export interface Payload {
  cwd?: string | undefined;
  session_id?: string | undefined;
  model?: ModelField | undefined;
  workspace?: Workspace | undefined;
  context_window?: ContextWindow | undefined;
  cost?: CostField | undefined;
  rate_limits?: RateLimits | undefined;
}
