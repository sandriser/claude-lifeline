import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import { parseGitStatus, fetchGit } from '../dist/git.js';

test('parseGitStatus extracts branch', () => {
  const r = parseGitStatus('## main...origin/main\n');
  assert.equal(r.branch, 'main');
  assert.equal(r.dirty, false);
  assert.equal(r.staged, false);
  assert.equal(r.detached, false);
});

test('parseGitStatus detects dirty and staged', () => {
  const out =
    '## feature-x\n' +
    ' M a.txt\n' + // modified in working tree
    'A  b.txt\n'; // added (staged)
  const r = parseGitStatus(out);
  assert.equal(r.branch, 'feature-x');
  assert.equal(r.dirty, true);
  assert.equal(r.staged, true);
});

test('parseGitStatus detects detached HEAD (modern format)', () => {
  const r = parseGitStatus('## HEAD (no branch)\n M a.txt\n');
  assert.equal(r.detached, true);
  assert.equal(r.branch, '');
  assert.equal(r.dirty, true);
});

test('parseGitStatus detects detached HEAD (legacy format)', () => {
  const r = parseGitStatus('## detached from abc1234\n');
  assert.equal(r.detached, true);
  assert.equal(r.branch, '');
});

test('parseGitStatus handles empty input', () => {
  const r = parseGitStatus('');
  assert.equal(r.branch, '');
  assert.equal(r.detached, false);
});

test('fetchGit returns null outside a git repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lifeline-notgit-'));
  try {
    // Non-existent subdir -> git fails -> null
    assert.equal(fetchGit({ cwd: join(dir, 'nope') }), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fetchGit returns git info inside a repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lifeline-git-'));
  try {
    execFileSync('git', ['init', '-q', '-b', 'main', dir]);
    execFileSync('git', ['config', 'user.email', 't@t.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
    const f = join(dir, 'a.txt');
    writeFileSync(f, 'hi');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });

    const info = fetchGit({ cwd: dir });
    assert.ok(info, 'should return git info');
    assert.equal(info?.branch, 'main');
    assert.equal(info?.dirty, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fetchGit times out gracefully (guarded)', () => {
  // A 1ms timeout on a non-repo path still returns null rather than throwing.
  const info = fetchGit({ cwd: '/definitely/not/a/repo/xyz' }, { timeoutMs: 1 });
  assert.equal(info, null);
});
