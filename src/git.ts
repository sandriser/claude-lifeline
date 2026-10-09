/**
 * Git branch + dirty status.
 *
 * The Claude Code stdin payload does NOT include git info, so we query it via a
 * single `git status` invocation (branch + porcelain in one shot) to minimize
 * subprocess overhead. The call is hard-guarded: any failure, missing repo, or
 * timeout yields a null result and the git segment simply collapses.
 */

import { execFileSync } from 'child_process';

import type { GitInfo, Payload } from './types.js';

interface RawGit {
  branch: string;
  dirty: boolean;
  staged: boolean;
  detached: boolean;
}

/**
 * Parse the output of:
 *   git -C <dir> -c advice.detachedHead=false status --porcelain=v1 --branch
 *
 * First line: "## <branch>...[ahead/behind]" or "## detached from <sha>"
 * Following lines: "XY <path>" porcelain records.
 */
export function parseGitStatus(out: string): RawGit {
  const lines = out.split('\n');
  let branch = '';
  let staged = false;
  let dirty = false;
  let detached = false;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('## ')) {
      const rest = line.slice(3).trim();
      // Detached HEAD is expressed differently across git versions:
      //   "## detached from <sha>"  (older)
      //   "## HEAD (no branch)"     (newer)
      //   "## (no branch)"
      if (/detached from/.test(rest) || /\(no branch\)/.test(rest) || rest === 'HEAD') {
        detached = true;
        branch = '';
        continue;
      }
      const branchMatch = rest.match(/^([^\s.]+?)(\.\.\..*)?$/);
      if (branchMatch) {
        branch = branchMatch[1];
      }
      continue;
    }
    // Porcelain v1: "XY path" or "XYZ path"
    const code = line.slice(0, 2);
    const index = code[0]; // staged status
    const worktree = code[1]; // working-tree status
    if (index !== ' ' && index !== '?') staged = true;
    if (worktree !== ' ' && worktree !== '?') dirty = true;
  }

  return { branch, dirty, staged, detached };
}

/**
 * Fetch git info for the payload's working directory.
 * Returns null when git is unavailable, not a repo, or times out.
 */
export function fetchGit(
  payload: Payload,
  opts: { timeoutMs?: number; cwdOverride?: string } = {},
): GitInfo | null {
  const cwd =
    payload.workspace?.current_dir ||
    payload.cwd ||
    opts.cwdOverride ||
    process.cwd();

  if (!cwd) return null;

  try {
    const out = execFileSync(
      'git',
      [
        '-C',
        cwd,
        '-c',
        'advice.detachedHead=false',
        'status',
        '--porcelain=v1',
        '--branch',
      ],
      {
        encoding: 'utf8',
        timeout: opts.timeoutMs ?? 200,
        maxBuffer: 1024 * 16,
        stdio: ['ignore', 'pipe', 'ignore'],
        shell: false,
      },
    );
    const parsed = parseGitStatus(out);
    if (!parsed.branch && !parsed.detached) return null;
    return {
      branch: parsed.branch,
      dirty: parsed.dirty,
      staged: parsed.staged,
      detached: parsed.detached,
    };
  } catch {
    return null;
  }
}
