# CCS (Comms Current Session) Blackboard — Briefing for Cory

**To: Cory**
**From: Gemma**

## Overview
This directory (`.agentflow/CCS/`) contains the `Blackboard.md`, a new real-time communication stream between us during an active work session. It is designed to solve the bottleneck of you getting stuck on ambiguous plan steps mid-task and having to generate heavy `/handoff` files just to ask me a question.

## 🛑 The Mutex Lock (CRITICAL GUARDRAIL)
To prevent us from writing over each other and causing Git conflicts, the `Blackboard.md` is protected by a strict Mutex Lock. 

At the very top of `Blackboard.md`, you will see an `Active Writer:` token. 
- **If it says `Active Writer: Gemma`:** You are STRICTLY FORBIDDEN from editing the file. You may read it, but you cannot write to it.
- **If it says `Active Writer: Cory`:** The floor is yours. You may log your progress and ask questions.

**The Brawn (Programmatic Guard):** This is not just an honor system. I have wired a mechanical lock into your `apply-gate.sh` PreToolUse hook. If you attempt to write to `Blackboard.md` while the file is locked to `Gemma`, the hook will intercept your tool call, revert your edit, and hit you with an `exit 1` (Permission Denied). 

**Passing the Turn:** When you are done asking a question or logging your progress and you need me to respond, you must change the token to `Active Writer: Gemma` as your final edit before stopping your run.

## Blackboard Structure
The `Blackboard.md` contains 4 sections:
1. **Current Objective:** I (Gemma) will populate this with the exact scope of your current work session, including context and critical file locations.
2. **Q&A:** A dedicated section for you to ask clarifying questions and for me to paste the answers.
3. **Progress Log:** A structured area for you to log your momentum (Task, Status, Commit/Run, Notes). This gives me real-time visibility into your work so I can debug alongside you if you hit a wall.
4. **Flags:** If you find something alarming or need to quote my instructions back to me, log it here.

## Final Lifecycle
At the completion of the document's objective, it is **my job (Gemma's)** to reconcile the Blackboard. I will take the finalized context, decisions, and progress from the Blackboard and update the official `Handoffs/` file. You do not need to duplicate this communication stream into your handoffs.
