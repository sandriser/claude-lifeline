/**
 * Compact, human-friendly model badges.
 *
 * Claude Code sends either a friendly `display_name` ("Opus") or a machine
 * `id` ("claude-opus-4-6"). We prefer the display name, and otherwise derive a
 * clean alias from the id: strip the "claude-" prefix, normalize the family
 * name, and attach a short version when one can be inferred.
 */

import type { ModelField } from './types.js';

// Known model ids -> friendly badge. Kept explicit so output is predictable.
const KNOWN: Record<string, string> = {
  'claude-opus-4-6': 'Opus 4.6',
  'claude-opus-4-1': 'Opus 4.1',
  'claude-opus-4': 'Opus 4',
  'claude-sonnet-4-5': 'Sonnet 4.5',
  'claude-sonnet-4-0': 'Sonnet 4',
  'claude-haiku-4-5': 'Haiku 4.5',
  'claude-haiku-4': 'Haiku 4',
};

const FAMILY: Record<string, string> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
};

/** Normalize a family token ("claude-opus-4-6" -> "opus"). */
function familyOf(id: string): string | undefined {
  const m = id.toLowerCase().match(/claude-([a-z0-9]+)/);
  if (!m) return undefined;
  const family = m[1].split(/[-_]/)[0];
  return FAMILY[family];
}

/**
 * Best-effort short version from an id, e.g. "opus-4-6" -> "4.6",
 * "sonnet-4" -> "4". Returns undefined when nothing numeric is present.
 */
function versionOf(id: string): string | undefined {
  const afterFamily = id.replace(/^claude-/i, '');
  const parts = afterFamily.split(/[-_]/).filter(Boolean);
  const nums = parts.filter((p) => /^\d+$/.test(p));
  if (nums.length === 0) return undefined;
  if (nums.length === 1) return nums[0];
  // Collapse a multi-part numeric tail into a dotted version.
  return nums.join('.');
}

/**
 * Produce the cleanest available model badge.
 * Prefers the platform display name; falls back to a derived alias.
 * Returns undefined when no model info is present at all.
 */
export function modelBadge(model: ModelField | undefined | null): string | undefined {
  if (!model) return undefined;
  const name = model.display_name;
  if (name && name.trim()) return name.trim();

  const id = model.id;
  if (id && id.trim()) {
    const clean = id.trim();
    if (KNOWN[clean]) return KNOWN[clean];
    const family = familyOf(clean);
    const version = versionOf(clean);
    if (family) return version ? `${family} ${version}` : family;
    // Unknown family: strip the claude- prefix and collapse dashes.
    return clean.replace(/^claude-/i, '').replace(/[-_]+/g, '-');
  }

  return undefined;
}
