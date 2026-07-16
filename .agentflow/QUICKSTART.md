# AgentFlow Quickstart Guide

**AgentFlow** is an "AI Engineering Team in a Box." It is a portable architecture that drops two specialized AI agents into your project: **Gemma** (The Architect/Planner) and **Cory** (The Builder/Implementer). It enforces strict execution discipline, automated testing gates (Circuit Breakers), and a RAG (Retrieval-Augmented Generation) knowledge base to keep the AI aligned with your specific domain rules.

---

## 🚀 1. Setup

### Option A: Setting up in a New Project
1. **Initialize your Repo:** Create a blank directory for your new project (`mkdir my-new-app && cd my-new-app`).
2. **Drop in the Package:** Extract the `agentflow.tar.gz` package into the root. You should now have an `.agentflow/` directory.
3. **Run Initialization:** Execute `./.agentflow/bin/init.sh`.
   - *What this does:* Scaffolds your tracking directories (`Plans/`, `Handoffs/`) and arms the local Circuit Breaker to prevent rogue AI edits.
4. **Boot the Team:** Run `./.agentflow/bin/mornin.sh team`.
   - *What this does:* Instantly launches Gemma in your current terminal and pops open a new window running Cory.

### Option B: Setting up in an Existing Project
1. **Drop in the Package:** Extract the `agentflow.tar.gz` package into the root of your existing codebase.
2. **Run Initialization:** Execute `./.agentflow/bin/init.sh`.
   - *Note:* AgentFlow uses specific tracker files. It will create `Open Items.md`, `Plans/`, and `Handoffs/` at your root. If you already have files with these exact names, back them up first.
3. **Arm the Knowledge Base:** Navigate to `.agentflow/knowledge/`. Update the markdown files to reflect the tech stack and design rules of your *current* codebase so Gemma and Cory know the rules of the existing project.

---

## 🧠 2. Long-Term Maintenance & Success

To ensure AgentFlow remains highly accurate and doesn't hallucinate over time, you must maintain its three core pillars:

1. **Maintain the Knowledge Base, NOT the Prompts**
   - If your project switches from React to Vue, **do not** rewrite Gemma or Cory's base personas. 
   - Instead, open `.agentflow/knowledge/domain-vocabulary.md` or `.agentflow/flags/ui_taste.md` and update the markdown text. The agents automatically search (RAG) this folder / the flag registry; updating the text instantly updates their behavior without risking prompt decay.
2. **Enforce the Write Bracket**
   - **Gemma** maps the architecture and writes plans to `Plans/Dispatch/`. She does not touch your source code.
   - **Cory** reads the plans and writes the source code. He does not plan macro-features.
   - Never let them cross boundaries, or context will blur.
3. **Treat `Open Items.md` as Absolute Truth**
   - Both agents read `Open Items.md` to understand current project state. Keep it strictly updated. When a task is done, move it to `## Resolved`. If you let this file go stale, the agents will lose the plot.

---

## ⚠️ 3. Troubleshooting & Potential Issues

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **`mornin.sh team` doesn't open a second window** | macOS restricts terminal automation (AppleScript/osascript) for security. | Open macOS `System Settings > Privacy & Security > Accessibility` and grant permission to your Terminal app. |
| **Cory is failing to write files / Circuit Breaker trips instantly** | The `apply-gate.sh` hook is catching an error. Usually, this means Cory wrote code that broke a local test, or the test runner itself is misconfigured. | Check your local test suite. If the tests are broken, Cory cannot write code. Fix the tests manually, or temporarily bypass the hook if you are doing a massive refactor. |
| **Agents are ignoring UI/Domain rules** | The files in `.agentflow/knowledge/` are too long or poorly formatted, causing the agents' `grep` searches to fail. | Keep knowledge files dense and concise. Use clear keywords like "UI Rules" or "Database Schema" so the agents' search tools can easily extract the exact paragraphs they need. |
| **"Terminal Corrupted / Hanging" on `/handoff -l`** | The SIGKILL command killed the process before it could restore the terminal's active screen state. | Type `reset` and hit Enter in the terminal to restore the standard layout, and ensure `.agentflow/skills/handoff/SKILL.md` is using standard `kill` instead of `kill -9`. |
