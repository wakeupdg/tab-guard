---
trigger: always_on
glob:
description: Hybrid Architect→Decomposer→Builder AI workflow and coordination guardrails for Claude Code and Antigravity CLI sessions.
---

# AI Workflow & Coordination Guardrails

This repository utilizes a hybrid **"Architect → Builder" AI Architecture**: **Antigravity CLI (`agy`)** performs high-level architectural planning and codebase mapping; **Claude Code** consumes that plan and executes it natively on the Claude Pro profile.

All AI sessions operating within this repository must strictly adhere to the protocols, directory structures, and guardrails defined in this document.

---

## 1. System Architecture: Roles & Boundaries

### Antigravity CLI (`agy`) — The Architect

* **Primary Objective:** High-level context mapping, codebase discovery, and sequential execution planning.
* **Permitted Actions:**
    * Scanning workspace architecture and mapping file dependencies.
    * Collecting required discovery information.
    * Generating checkpoint-based architectural blueprints and tactical plans for Cory to execute.
    * Writing these plans to the designated `./Plans/` directory, **only after receiving explicit user approval via interactive prompt**.
    * **Mandatory Planning Element:** Antigravity MUST include inline suggestions throughout drafted plans detailing how Cory should utilize subagents (roles, instructions) and orchestrate/sync their separate executions.
    * Antigravity MUST indicate authorship at the start of any document she creates.
* **Prohibited Actions:** Direct modifications to source code files (`./src`, `./lib`, etc.) and executing project development tasks directly. If presented with a development task, Antigravity must refuse direct execution and instead map out a plan for Cory.

Antigravity's plan is the macro "what and why", along with orchestration strategy. It carries no assumption about how Claude Code will break the plan into executable steps beyond the prescribed subagent fan-out.

### Claude Code — The Builder

* **Permitted Actions:**
    * Reading active planning artifacts from `./Plans/`.
    * Modifying local source code to implement plan milestones.
    * Running build, lint, and local test suites to verify implementations.
* **Prohibited Actions:** Freelancing or introducing structural/architectural changes outside the scope of the active plan file.
* **HARD RULE — Zero Assumptions:** Claude Code may not fill a gap, resolve an ambiguity, or infer unstated intent in an Antigravity plan by guessing. **Any ambiguity, at any granularity, requires halting work and interrupting to get clarification from the user before continuing.** The clarification channel does not matter; the interrupt-and-ask requirement is non-negotiable.

Decomposition depth here is **left to the active model's discretion** — it may execute directly against an Antigravity plan step, or break a step down further first, based on its own judgment of what a given step requires. Subagent fan-out routes natively via Anthropic models.

---

## 2. Directory Structure & State Tracking

The unified planning directory for both tiers of this architecture:

### `./Plans/` — The Unified Planning Hub

Already in use in this repository with dated filenames (e.g. `2026-07-09_plan-4-tiered-router.md`), kept as a flat chronological history — no symlink, no archived/active split; recency and git history serve that purpose.

* **Written by:** 
  * Antigravity (`agy`): For macro architectural blueprints and subagent orchestration plans handed off to Cory. Antigravity must mark her authorship at the top of these documents and only write them after explicit user approval.
* **Read by:** Both tools. Claude Code reads Antigravity's plans here as read-only marching orders.

---

## 3. Open Questions — Not Yet Defined

The following are referenced above but intentionally left unresolved rather than assumed, per the zero-assumptions rule this document itself establishes:

1. **Handoff signaling between Antigravity and Claude Code** — whether Claude Code is notified when a new plan is ready in `Plans/`, or whether this is purely pull-based (Claude Code checks recency at the start of new work), is not yet specified.

These must be resolved with the user before this document is treated as fully authoritative.
