# Example payloads

Ready-to-use stdin fixtures for `claude-lifeline`. Pipe any of them through the
built binary to see the rendered output:

```bash
node dist/index.js < examples/full-payload.json
node dist/index.js < examples/minimal-model.json
node dist/index.js < examples/context-and-cost.json
node dist/index.js < examples/rate-limits.json
node dist/index.js < examples/malformed.json   # renders nothing
```

| File | Demonstrates |
| --- | --- |
| `full-payload.json` | Every segment: model, context gauge, 5h/7d rate limits, cost. |
| `minimal-model.json` | A payload with only `model.id` — renders just the badge (+ git). |
| `context-and-cost.json` | Context bar near capacity (91%) plus cost, no rate limits. |
| `rate-limits.json` | 5h/7d usage percentages without context or cost. |
| `malformed.json` | Invalid JSON — must render nothing (never crashes). |
