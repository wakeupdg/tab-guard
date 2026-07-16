# Exit-Code & Pipe Verification Discipline

Payload flag — loaded just-in-time whenever a task runs shell commands whose success will be checked (tests, builds, background jobs). Captured via `/learn` on 2026-07-14, from a live incident: a `pytest` run piped through `tail` reported the pipe's own exit code (`0`, from `tail` succeeding) instead of `pytest`'s real exit code (a collection failure), which briefly masked a broken test run.

- **A piped command's reported exit code is the LAST command's, not the one you care about.** In `cmd | tail -N` (or `| grep`, `| head`, etc.), `$?` reflects the pipe filter, not `cmd`. This applies to background-job completion notifications too — "exit code 0" on a piped chain describes the tail stage, not necessarily the tool run itself.
- **Capture the command of interest's own exit status directly**: redirect to a file instead of piping through a filter (`cmd > log 2>&1; echo $?`), or use `${PIPESTATUS[0]}`/`set -o pipefail` if a pipe is unavoidable.
- **When a reported success looks inconsistent with the actual output, re-run the command standalone** (no pipe) to get its unambiguous real exit code before trusting it.
