# Fable 5 Execution Plan: Quickstart & Briefing

Welcome to the **Fable 5 Architecture**. This guide is written for engineers (CS background) who are familiar with software development but may have limited experience orchestrating autonomous LLM (Large Language Model) agents.

This document explains exactly **why** this architecture exists, **how** it protects your codebase, and **how** to work alongside it effectively.

---

## 1. The Core Problem: Why Do We Need Fable 5?

By default, LLMs are probabilistic text generators. They suffer from three massive flaws when deployed as autonomous coding agents:
1. **The "Yes Man" Flaw:** If you ask an LLM to rewrite a perfectly good database schema into a completely unproven technology, it will happily comply and destroy your project's stability. It rarely challenges underlying assumptions.
2. **The Infinite Hallucination Loop:** If an LLM writes code that fails a unit test, it will try to fix it. If the fix fails, it tries again. Standard LLMs can get trapped in this loop, blindly guessing at solutions, burning through thousands of API tokens and dollars without making progress.
3. **Weak Context Serialization:** When an LLM delegates work to another LLM, it often summarizes the task poorly, causing the subagent to hallucinate because it lacks the strict mathematical constraints of the original problem.

**The Solution:** The Fable 5 Execution Plan is a structural straightjacket placed over the LLMs. It forces them to execute rigid, hostile logic checks (Moves) before writing code, and puts physical bash-level guardrails around their execution environment.

---

## 2. The Multi-Agent Architecture

This repository uses a dual-agent structure:

*   **Gemma (The Architect):** Driven by Antigravity (Gemini). Gemma does *not* write source code. Her job is macro-planning, project tracking (`Plans/`, `Handoffs/`), and structural oversight.
*   **Cory (The Builder):** Driven by Claude Code. Cory writes the actual source code (`src/`, `tests/`) and executes terminal commands. Cory operates on two profiles:
    *   `claude-or`: Uses OpenRouter API (cheaper, but charges per-token).
    *   `claude-pro`: Uses Anthropic Subscription (flat-rate, premium reasoning).

---

## 3. How Fable 5 Protects You (Real Examples)

### A. "The Pushback" (Gemma’s Interrogation Protocol)
*   **The Fable Move:** Move 1 (Check the Presupposition)
*   **What it does:** Gemma is explicitly programmed to challenge structural requests. 
*   **Example:** You tell Gemma, *"Let's switch our backend to FastAPI."* Instead of blindly writing a migration plan, Gemma will stop you and output a `### 🧠 Fable 5 Narration` block. She will aggressively interrogate your assumption: *"Why do you think FastAPI solves our bottleneck? Have you profiled the current latency?"* She forces you to justify the engineering cost before any code is touched.

### B. "The Circuit Breaker" (Cory’s Write Gate)
*   **The Fable Move:** Move 4 & 6 (Physical Verification & Attack Conclusion)
*   **What it does:** We installed a script (`apply-gate.sh`) that physically intercepts every file Cory tries to save. It instantly runs `pytest-testmon` (which maps source code directly to tests for surgical speed).
*   **Example:** Cory writes a logic fix but accidentally breaks a downstream test. The gate blocks the save. Cory tries again, but hallucinates and fails the exact same test. Immediately, the **Circuit Breaker** trips (Exit Code 2). Cory's execution is forcefully terminated, preventing him from draining your API credits in an infinite loop.

### C. "The Hostile Peer Review" (Alex Co-working Protocol)
*   **The Fable Move:** Move 6 (Hostile Counter-Examples)
*   **What it does:** Cory can spawn a subagent named **Alex**. To prevent context loss, Cory is forced to bundle his work using a rigid serialization template (`[Task Context] [Original Code] [Proposed Diff] [Test Logs]`).
*   **Example:** You ask Cory to have Alex review his code on the `claude-pro` profile. Alex is dynamically pinned to a premium reasoning model (`claude-3-5-sonnet`). Operating in read-only "Validation Mode," Alex attacks Cory's logic with hostile counter-examples, providing you with a senior-level code review in seconds.

---

## 4. How to Interact with the System

Because Fable 5 is heavy on reasoning, it consumes slightly more output tokens (which costs time and context-window space). For complex engineering tasks, this is highly desirable. For trivial tasks (like updating a README typo), it is overkill.

### The Toggle Command
You can turn Fable 5 reasoning ON or OFF at will during a session.
*   Type `/fable off` to disable the heavy reasoning loop.
*   Type `/fable on` to re-enable it.
*   *Note: Fable 5 is forcefully reset to **ON** every time you start a new session via the `mornin` boot script.*

### The `/scratch/` Sandbox Exemption
If you want Cory to freely experiment with code without triggering the rigorous `pytest-testmon` Circuit Breaker, simply have him write files into a directory named `/scratch/`. The gate explicitly ignores this path, allowing for rapid prototyping.

---

## 5. Summary for Engineers

Treat Gemma and Cory not as magical oracles, but as junior engineers who need guardrails. The Fable 5 plan provides those guardrails. It ensures that architectural decisions are interrogated, test failures immediately halt execution to save budget, and peer reviews are strictly decoupled and hostile. 

You are the Tech Lead. Fable 5 ensures your AI team acts like professionals.
