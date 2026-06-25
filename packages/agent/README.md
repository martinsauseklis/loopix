# @loopix/agent

The loopix triage/fix engine + the `loopix` CLI. Drives Claude Code headless
(`claude -p`); the fix runs in an isolated git worktree.

```bash
loopix triage --once   # diagnose the oldest new report (read-only)
loopix fix             # fix a triaged + autoFixable report on a branch
```

See the [loopix README](../../README.md) for the full guide.
