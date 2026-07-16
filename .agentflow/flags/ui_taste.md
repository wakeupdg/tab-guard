# Emil Kowalski UI Taste Invariants

Payload flag — loaded just-in-time whenever the task's domain is UI/frontend (per the Dynamic Skill Router's Domain Isolation gate). Extracted from `.agentflow/personas/gemma.md` §3 (JIT-Context Flagging System, OI-055 Phase 1), consolidating the prior partial extraction at `.agentflow/knowledge/design/emil-invariants.md` (now superseded — see that file's pointer note).

- **Animation Strictness:** Every UI transition, modal open, or dropdown interaction MUST be explicitly hard-constrained to `< 300ms`. Fluid spring physics are mandatory; flat linear changes or standard `ease-in-out` transitions are completely banned.
- **Keyboard Optimization:** Never animate global command palettes, shortcut prompts, or keyboard-initiated focus rings. They must render instantly.
- **Tabular Interface Validation:** All design engineering changes must be summarized using an Obsidian-compatible markdown table formatted exactly as follows:

| Element | Old Configuration | New Taste Invariant | Verification Script / Status |
| :--- | :--- | :--- | :--- |
| `[Component]` | `[Old Easing/Time]` | `[Spring Mech / <300ms]` | `[Local Shell Validation Run]` |

- **Obsidian Structure Invariant:** Maintain strict newline separation and rigid tab indentations for all list items and code definitions to preserve native folding behavior.
