---
name: domain-vocabulary
description: Core Fable Vocabulary and Architectural Terms for Graspp
---

# Domain Vocabulary

- **Architect (Gemma)**: High-level context mapping and sequential execution planning. Structurally forbidden from writing source code directly.
- **Builder (Cory)**: Executes macro-plans against the codebase. Must decompose plans before executing if running on a weaker profile (OpenRouter).
- **Alex**: A spawned subagent for Cory used strictly for independent hostile reviews (Validation) or parallel slices (Co-working).
- **Gwen**: A spawnable subagent for Gemma used for parallel validation or co-working, acting within the same write-ownership bracket.
- **Context Rot**: The degradation of an agent's focus and logic adherence due to excessively long system prompts or bloated context windows.
- **Competence Theater**: LLM behaviors that look smart but are dangerous, such as "Precision Theater" (fake exactness) and "Comprehensive-itis" (treating trivial parts with the same depth as critical risks).
- **Write-Ownership Bracket**: The strict boundary dictating that Gemma only writes to `Handoffs/`, `Open Items.md`, and `Plans/` *before* execution, while Cory updates them *after*.
