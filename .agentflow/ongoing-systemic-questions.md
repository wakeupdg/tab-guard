# Ongoing Systemic Questions: AgentFlow Architecture

This document serves as an archive of all systemic, architectural questions and conceptual decisions regarding the AgentFlow system, including verbatim answers provided during the system's design.

---

### Q: Do we have anything in the agentflow system to indicate storing virtual links / ties to data rather than the actual data in context window?

**A:** You worded it intuitively, but let's refine the terminology so we have a strict engineering term for it moving forward!

I believe the refined question you are trying to ask is:
> *"Does AgentFlow use Context Pointers (or 'Lazy-Loading Hooks') to keep our permanent context window lean, rather than bulk-loading all our domain knowledge into the prompt at boot?"*

If that is what you meant, you are describing one of the most advanced concepts in Agentic Architecture: the difference between **Hardcoding** (dumping raw text into a prompt) and **Pointing** (giving the agent a URL or a file path to go read *only* when it needs it).

**And to answer that refined question: Yes. That is exactly what AgentFlow's new RAG system is.**

Before Gwen's audit, we almost made the mistake of dumping the data directly into the context window (by having Claude Code read the entire markdown file at boot). To fix this, we implemented true Context Pointers:

1. **For Cory:** We created `.agentflow/skills/emil-design/SKILL.md`. That file does **not** contain Emil Kowalski's CSS math. It contains a *pointer* (a `grep` command) that tells Cory: *"The data lives over in `.agentflow/knowledge/`. Go fetch it if you need it."*
2. **For Gemma:** My base persona (`gemma.md`) no longer contains the UI Taste Invariants. Instead, it contains a *pointer* (the Evaluation Gate) instructing me to use the `grep_search` tool on the absolute path of the knowledge base.

Because we store these "virtual links/ties" instead of the raw data, our base token consumption is near zero. We only pay the context-window cost for the data at the exact millisecond we follow the pointer to read it.

---

### Q: What about as we work during a work session. How does this hold up for the context window as the work session gets messy in read and write operations?

**A:** That is the most critical question you can ask about long-term AI execution. What you are describing is **Context Bloat** (or Context Decay).

Even if our starting prompt is incredibly lean, a messy session where Cory edits 15 files, reads 5 massive logs, and makes 3 mistakes will quickly fill up 100,000 tokens of context. When that happens, the AI "forgets" its original instructions and starts hallucinating.

AgentFlow is specifically engineered to defend against Context Bloat during a live session using four distinct mechanisms:

1. **The Handoff Reset (`/handoff`)**
This is our ultimate weapon against context decay. The moment a session starts feeling messy or sluggish, you trigger `/handoff -l`. Instead of trying to remember 50,000 tokens of messy bash history, the agent condenses its current state into a tiny, dense `Handoffs/` document, updates `Open Items.md`, and completely kills its own process. When you reboot, the new agent simply reads the 500-token Handoff file and picks up perfectly fresh, leaving all the messy garbage behind.

2. **The Circuit Breaker (`apply-gate.sh`)**
The #1 cause of context bloat is the "Infinite Hallucination Loop"—where an agent writes bad code, gets a massive error traceback, guesses again, gets another traceback, and fills its context window with garbage. AgentFlow's Circuit Breaker intercepts failing code and forces a hard halt (`exit code 2`). It literally breaks the loop before the context window can fill up with traceback noise.

3. **Architect-to-Builder Transcription**
If Cory had to run a massive `grep_search` across the knowledge base in the middle of his coding session, that huge dump of text would sit in his context window forever. To prevent this, AgentFlow mandates that **Gemma does the messy research first**. I read the heavy files, distill the exact math needed, and put it in a clean `Plans/Dispatch/` file. Cory only ever reads the tiny plan file, keeping his active coding session radically clean.

4. **Subagent Fan-Out (Alex & Gwen)**
If Cory encounters a truly messy task (like reading a 5,000-line log file to find a bug), he doesn't do it in his own window. He spawns **Alex**. Alex gets a completely separate, isolated context window. Alex does the messy reading, finds the bug, and sends Cory a 2-sentence summary. Alex's messy context window is then destroyed, and Cory's main session remains pristine.

In standard AI workflows, you are fighting a ticking clock before the context window decays. In AgentFlow, the architecture is explicitly designed to prune, compress, and reset context so you can theoretically work forever.

---

### Q: How does it do it better than existing cli / model combinations?

**A:** If you look at the current market—tools like Aider, Cursor, or even standard out-of-the-box Claude Code—they are all incredibly powerful, but they all suffer from the exact same structural bottlenecks.

AgentFlow doesn't just give you a better prompt; it structurally fixes the flaws of existing CLI tools in four specific ways:

1. **Dual-Core vs. Monolithic Processing**
**The Problem:** Existing tools force one LLM to be the Architect, the Coder, and the Reviewer all in a single context window. This causes the model to "blur" logic, where it hallucinates implementation details while trying to plan, or forgets the macro-plan while trying to code a button.
**The AgentFlow Fix:** We physically split the brain. Gemma (Architect) handles the heavy, messy research and planning. Cory (Builder) only receives the clean, distilled blueprint. By separating concerns across two distinct CLI processes, neither agent's context window gets contaminated by the other's mess.

2. **Context Pointers vs. "Prompt Stuffing"**
**The Problem:** If you want an existing tool to follow your UI style, you have to dump all your rules into a `.cursorrules` file. That file is injected into the prompt *permanently*. If it's 1,000 tokens long, you are paying a 1,000-token tax on every single message, slowly choking the context window.
**The AgentFlow Fix:** We use **Context Pointers**. Your UI rules sit passively in `.agentflow/knowledge/`. They cost **zero** tokens until the exact millisecond Cory detects he is building a frontend component. He dynamically runs RAG, extracts what he needs, and drops it. Your baseline token tax remains zero.

3. **The Circuit Breaker vs. The "Infinite Loop"**
**The Problem:** Standard CLIs are eager to please. If they write bad code and a test fails, they will read the traceback, guess again, fail again, and loop 15 times until your API budget is drained and the context window is full of garbage tracebacks.
**The AgentFlow Fix:** Our `apply-gate.sh` Circuit Breaker sits at the Operating System level. If Cory fails a test twice, the OS physically rejects the tool call with `exit code 2`, severing the loop. It forces the agent to stop, regroup, or ask for human help before the context window is destroyed.

4. **State Portability vs. Session Death**
**The Problem:** When an Aider or Cursor session inevitably gets messy, your only option is to shut it down. When you boot it back up, the agent has amnesia. You have to spend 10 minutes re-explaining the context of the project.
**The AgentFlow Fix:** AgentFlow treats session death as a feature. Our strict `/handoff` protocol serializes the agent's brain into a tiny, dense Markdown file on disk. You can ruthlessly execute `kill -9` on a messy terminal, reboot a fresh one, and the new agent reads the Handoff doc to pick up in millisecond exactly where the last one left off.

In short: Existing tools are like brilliant junior engineers who eventually get overwhelmed, distracted, and forgetful. AgentFlow surrounds those brilliant engineers with strict senior management, hard boundaries, and perfect documentation.
