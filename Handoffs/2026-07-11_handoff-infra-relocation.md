# Handoff — 2026-07-11 (session 2: handoff-infra relocation)

## Context Recap
User's earlier `/handoff -l` had created handoff infra (skill + data) in the **global** `~/.claude/` directory. User clarified the correct model: the `/handoff` **skill is global** (shared across all projects), but the handoff **infra is per-project** — it must live in the project root of whatever dir `/handoff` is called from, and the skill should refuse to create infra in a non-git (non-project) directory. This session relocated the infra and hardened the skill. (The same-day prior session's summary lives at `Handoffs/2026-07-11_handoff-session-summary.md` — separate work, preserved.)

## Changes Since Last Session
- **Relocated handoff infra from `~/.claude/` into the project root** (`tab-guard-extension/`):
  - `Handoffs/2026-07-11_handoff-session-summary.md` (the prior session's summary — preserved)
  - `Open Items.md` (open-items tracker — preserved, 1 resolved item)
  - `Plans/Dispatch/` (newly created; skill references it but it had never existed)
- **Restored the `/handoff` skill to global** (`~/.claude/skills/handoff/SKILL.md`) after an initial mistake that had moved it into the project. Skill is intentionally GLOBAL — every project calls the same skill; only the infra it operates on is per-project.
- **Hardened the skill with two behavioral additions:**
  - **Step 0 — git-repo guard:** verify the calling dir is a git repo before touching infra; if not, refuse to create infra and abort (no exit step either). Prevents the skill from littering handoff files in arbitrary non-project directories.
  - **Create-if-missing clauses** in Steps 1/2/3 so the skill bootstraps `Handoffs/`, `Open Items.md`, and `Plans/Dispatch/` on first use in a new git project (instead of failing on a missing dir).
  - Added a path-scope clarification (all paths resolve against the calling dir) and a "Keeping infra local" advisory section.
  - **Internal run/exit behavior is UNCHANGED** — invocation, trigger condition, step order, and the Step 4 `kill $PPID`/SIGTERM exit mechanism (incl. OI-052 SIGKILL caveat) are byte-identical. Verified via side-by-side review at user's request.
- **Confirmed global `~/.claude/` is free of handoff infra** — eliminates the accidental-write risk the user was concerned about. No settings/hooks reference handoff.
- **Project memory updated:** `handoff-infra-lives-in-project.md` (feedback type) + indexed in `MEMORY.md`. Encodes: skill global, infra per-project + lives in project root, git-repo guard, handoff docs stay untracked (never auto-commit). Corrects an earlier memory draft that wrongly said the skill was project-scoped.

## Next Steps
- Nothing pending. Infra is correctly placed; skill is global + guarded.
- **Skill loads next session.** The updated `SKILL.md` is on disk; for other projects it registers on their next session / `/restart` (skill lists are built at startup).
- Consider whether to add `Handoffs/`, `Open Items.md`, `Plans/` to the repo's `.gitignore` (they're intentional untracked working docs). Left as user's call — not done this session.
- No `tab-guard-extension` product code changed this session — repo remains at `aa8a75a "Keep armed state synced across in-site SPA navigation"`.
