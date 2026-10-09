# claude-lifeline

Ultra-fast, zero-overhead status line for the [Claude Code](https://code.claude.com/) CLI.

It reads the JSON session payload Claude Code pipes to stdin on every refresh and renders a single, compact, ANSI-colored line showing your **model**, **context fuel gauge**, **rate-limit usage**, **git branch**, and **session cost** — in one shot.

- ⚡ **Fast** — sub-millisecond render; ~5 ms end-to-end including git (see [`npm run bench`](#development)).
- 🔌 **Zero dependencies** — pure Node.js stdlib. No packages, no network.
- 🤫 **Silent** — **no API calls, no background processes, no LLM tokens consumed.** The status line runs locally by design.
- 🛟 **Never crashes** — any missing, `null`, or malformed input collapses the affected widget instead of breaking the prompt.

---

## Install

Add a `statusLine` entry to your settings file (`~/.claude/settings.json` for all projects, or a project-local `.claude/settings.json` for one repo). Claude Code runs `statusLine.command` as a shell script on every refresh, piping session JSON to **stdin** and displaying whatever it prints to **stdout**.

```jsonc
{
  "statusLine": {
    "type": "command",
    "command": "/absolute/path/to/claude-lifeline/dist/index.js"
  }
}
```

Point `command` at the built executable. Make it executable once:

```bash
chmod +x /absolute/path/to/claude-lifeline/dist/index.js
```

Because claude-lifeline is a Node.js executable (it carries a `#!/usr/bin/env node` shebang), you can also shell out through `node` so no `chmod` is needed:

```jsonc
{
  "statusLine": {
    "type": "command",
    "command": "node /absolute/path/to/claude-lifeline/dist/index.js"
  }
}
```

### Install globally (optional)

```bash
npm install -g claude-lifeline
```

then point `command` at the binary on your `PATH`:

```jsonc
{
  "statusLine": {
    "type": "command",
    "command": "claude-lifeline"
  }
}
```

Claude Code reloads settings automatically — your status line appears immediately. To clear it later, remove the `statusLine` field (or run `/statusline clear`).

---

## What it shows

Segments are ordered by priority and joined with a dim ` › ` separator. Any segment with no data collapses cleanly.

| Segment | Example | Notes |
| --- | --- | --- |
| **Model** | `Opus 4.6` | Prefers `model.display_name`; otherwise derives a clean alias (`claude-opus-4-6` → `Opus 4.6`). Unknown families fall back to a cleaned id. |
| **Context** | `[███░░░░░░░] 72%` | A "fuel gauge": the bar fills to **remaining** %, colored green → yellow → red as it drains. |
| **Git** | `main`, `main +`, `main *`, `detached` | Branch name plus `+` for staged and `*` for a dirty working tree. Queries git via a single guarded subprocess; collapses if not in a repo. |
| **Rate limits** | `5h 41%`, `7d 19%` | 5-hour and 7-day usage %, plus an optional countdown to each window's reset. Only present for Pro/Max subscribers or a spend-limited gateway. |
| **Cost** | `$0.18` | Accumulated session cost in USD. |

On a narrow terminal, the lowest-priority segments are dropped first (cost → rate → git → context → model) so the most important info always survives; a single segment that still overflows is truncated with an ellipsis.

### Example

```
Opus › [███░░░░░░░] 72% › main › 5h 41% 7d 19% › $0.18
```

---

## Configuration

claude-lifeline works with **zero config**. To tweak it, drop a JSON file at any of these locations (first one found wins):

1. `$CLAUDE_LIFELINE_CONFIG`
2. `<cwd>/.claude-lifeline.json`
3. `$HOME/.claude-lifeline.json`

```jsonc
{
  "barWidth": 10,              // visible blocks in the context bar (1–40)
  "maxWidth": 120,             // max visible width before segments drop
  "separator": " › ",          // joined between segments
  "showResetCountdown": true,  // append "5h 1h59m"-style countdowns
  "showUsagePct": true,        // show the 5h/7d usage percentages
  "git": true,                 // enable the git subprocess; set false to skip
  "defaultColumns": 120        // width assumed when COLUMNS is unset
}
```

Any missing field, bad type, or parse error is ignored in favor of the built-in defaults — the config file is never required and never allowed to break the status line.

---

## Data it reads

claude-lifeline consumes these fields from the stdin payload (all optional; absent/`null`/wrong-typed keys are ignored):

| Field | Displayed as |
| --- | --- |
| `model.id`, `model.display_name` | Model badge |
| `context_window.used_percentage`, `remaining_percentage`, `context_window_size` | Context fuel gauge + `%` |
| `rate_limits.five_hour.*`, `rate_limits.seven_day.*` | Usage `%` and reset countdown |
| `cost.total_cost_usd` | Session cost |
| `cwd`, `workspace.current_dir` | Working directory used to locate the git repo |

Git branch/dirty state is **not** in the payload — it is queried via the git CLI. For the full, authoritative list of fields Claude Code can send, see the [official status line docs](https://code.claude.com/docs/en/statusline).

---

## Examples

The [`examples/`](./examples) directory contains ready-to-use stdin fixtures. Pipe any of them through the built binary to see (or demo) the output:

```bash
node dist/index.js < examples/full-payload.json
node dist/index.js < examples/minimal-model.json
node dist/index.js < examples/rate-limits.json
```

---

## Development

```bash
npm install        # install dev deps (TypeScript only)
npm run build      # compile src/ -> dist/
npm test           # build, then run the test suite
npm run bench      # latency benchmark (parse + render + git)
```

The suite covers parsing, model badges, formatting, rendering/truncation, git parsing, and end-to-end runs against the compiled executable.

---

## License

MIT
