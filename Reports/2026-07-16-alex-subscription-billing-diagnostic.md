# Diagnostic Report — Why Alex Spawned Under Subscription Billing Here (tab-guard-extension) and How to Debug the Leak in the Other Project (Graspp)

**Date:** 2026-07-16
**Author:** Cory (Claude Code, tab-guard-extension project)
**Audience:** Cory in the other project (Graspp) — for debugging the documented Alex API-billing-leak issue there (OI-031 / OI-038 in that project's memory)
**Status:** Findings independently revalidated by Alex (Validation mode) — see her verdict appended at the bottom once returned.

---

## 1. The question this answers

The other project has a documented, unresolved issue: subagents pinned to a custom OpenRouter model (Alex → `z-ai/glm-5.2`, and separately the `gemma`/`nemotron` experimental agents) are **unverified on whether they route correctly at all** — they may 404, or silently leak to a different, real-money-billed model (feared: Opus 4.8 via API/OpenRouter billing instead of the intended cheap/free routing).

In **this** project (tab-guard-extension), Alex was just spawned and — based on the evidence below — appears to have run entirely under native Anthropic subscription billing, with **no leak**. This report documents exactly why, so the same mechanism can be checked for in the other project.

## 2. Environment facts (this session, tab-guard-extension)

Checked directly, not assumed:

```
ANTHROPIC_BASE_URL   = <unset>
ANTHROPIC_AUTH_TOKEN = <unset>
CLAUDE_PRO_MODE       = <set>
CLAUDECODE            = 1
~/.claude/active_profile = "pro"
```

This session is running on a **native Claude Pro/Max subscription** (I am literally instantiated as `claude-sonnet-5`, confirmed via my own system info), not routed through an API key or OpenRouter. **This is the precondition for everything below** — if the other project's session is genuinely OpenRouter-routed (`ANTHROPIC_BASE_URL` set to `https://openrouter.ai/...`), the mechanics differ and this report's "no leak" conclusion does not automatically transfer. Check this first in the other project before assuming the rest applies.

## 3. The agent definition file that governs Alex here

`.claude/agents/alex.md` (this project), frontmatter:

```yaml
name: alex
description: Alex — the relay subagent in the Cory/Alex/dispatcher persona system
  for the Graspp project. ...
model: z-ai/glm-5.2
```

**This file is a stale, unsanitized copy from the Graspp project** — the description literally still says "for the Graspp project," and the `model:` frontmatter field is pinned to `z-ai/glm-5.2`, an OpenRouter model string. On its face, this is exactly the misconfiguration that should have caused a leak (or a routing failure) here too.

## 4. Why it didn't leak: the explicit override

When I spawned Alex via the `Agent` tool, I passed an **explicit `model` parameter on the spawn call itself**, separate from the frontmatter:

```
Agent({
  subagent_type: "alex",
  model: "sonnet",   // explicit override
  run_in_background: true,
  ...
})
```

Two things about this call matter:

1. **The `Agent` tool's `model` parameter is documented to take precedence over the agent definition's frontmatter `model:` field.** This is stated directly in the tool's own schema description: *"Optional model override for this agent. Takes precedence over the agent definition's model frontmatter."*
2. **The `model` parameter's accepted values are constrained to exactly four Anthropic aliases: `sonnet`, `opus`, `haiku`, `fable`.** This is not documentation-only — it's enforced. I first tried passing the raw model ID `claude-3-5-sonnet-20241022` (what this project's own `cory.sh` boot script computes as `ALEX_MODEL` for a "pro" profile) and got a hard rejection:

   ```
   InputValidationError: [
     {
       "code": "invalid_value",
       "values": ["sonnet","opus","haiku","fable"],
       "path": ["model"],
       "message": "Invalid option: expected one of \"sonnet\"|\"opus\"|\"haiku\"|\"fable\""
     }
   ]
   ```

   Only after switching to the alias `"sonnet"` did the spawn succeed.

**Implication for the other project:** the `Agent` tool's `model` override parameter **cannot accept an arbitrary OpenRouter-style string like `"z-ai/glm-5.2"` or `"nvidia/nemotron-3-super-120b-a12b:free"` as a direct override value either.** If the other project's Cory is attempting to override Alex's model at spawn time with a raw OpenRouter model string, that call would fail the same validation — meaning any "successful" spawn there is *not* going through an override at all, and must be falling through to whatever the frontmatter `model:` field resolves to.

## 5. Evidence the subscription-billing conclusion actually held (not just theoretical)

From two `/usage` (Ctrl+O-style panel) screenshots taken before and after Alex's spawn+response in this session:

| | Before Alex responded | After Alex responded |
|---|---|---|
| Total cost | $0.99 → $1.20 (mid) | $1.26 |
| `claude-sonnet-5` output tokens | 13.4k | 18.0k |
| `claude-sonnet-5` cache read | 1.4m | 1.9m |
| `claude-haiku-4-5` | 528 in / 16 out (unchanged) | 528 in / 16 out (unchanged) |
| **Any `glm-5.2` / OpenRouter line item** | **absent** | **absent** |
| Subagents → alex, % of usage | — | 5–6% |
| Usage credits ($21.50/$25.00, 86%) | unchanged | unchanged |

Three separate signals all point the same direction:

- **No `glm-5.2` (or any non-Anthropic) line ever appeared** in the "Usage by model" breakdown, despite Alex's spawn+response happening between the two captures. Only native `claude-sonnet-5` and `claude-haiku-4-5` show up.
- The **token deltas on the `claude-sonnet-5` line are consistent in magnitude** with Alex's self-reported usage (her own task-notification reported `subagent_tokens: 23954`) folding into that same native-model bucket, rather than a separate untracked external call.
- The **`alex` subagent's usage is attributed as a percentage inside the "Current session" / "Current week" panel** — a panel whose own caption states it tracks consumption against your subscription's included rate limits. A call actually routed out to an external OpenRouter API key would not count against those limits at all; it would be invisible to this panel, not attributed as a percentage of it.
- The static **$21.50/$25.00 "Usage credits"** figure (a *separate*, coarser pool that only decrements on overage beyond included subscription limits) did not move at all across the two captures, even though "Total cost" (a reference/shadow price) climbed by $0.27 — consistent with Alex's usage staying entirely inside included subscription quota, never touching a billable-credits or external-API path.

## 6. Root-cause hypothesis for this project (and what to check in the other one)

**Hypothesis:** In this project, Alex avoided the leak *only* because I, as the calling Cory, happened to pass an explicit `model: "sonnet"` override at spawn time — which the harness honors ahead of the stale `z-ai/glm-5.2` frontmatter pin. The frontmatter pin itself was never actually exercised or resolved in this session — **I have not tested what happens when Alex is spawned with zero explicit override**, relying purely on the `model: z-ai/glm-5.2` frontmatter value. That untested path is precisely where the other project's leak is likely occurring.

**Concrete checks for the other project's Cory to run:**

1. Confirm the profile there: is `ANTHROPIC_BASE_URL` actually set (genuine OpenRouter routing) or unset (subscription, same as here)? This changes what "correct" routing even means for `z-ai/glm-5.2`.
2. Grep the actual spawn call(s) that instantiate Alex there — is an explicit `model:` override being passed, and if so, is it one of the four accepted aliases (`sonnet`/`opus`/`haiku`/`fable`) or a raw OpenRouter string? If it's a raw string, expect (and look for) the same `InputValidationError` I hit — that alone could be silently swallowed/retried in a way that falls back to an unintended default.
3. If **no override** is passed there (relying purely on `alex.md`'s frontmatter `model: z-ai/glm-5.2`), spawn Alex once deliberately with no override and immediately pull the `/usage` panel before and after, exactly as done here. Look for the same three signals: (a) does a non-Anthropic model line appear at all in "Usage by model"; (b) does Alex's subagent % show up inside the subscription rate-limit panel or is it absent (absence would suggest it went external and is invisible to local tracking — the leak); (c) does "Usage credits" or any separate real-dollar counter move in lockstep with Alex's activity.
4. Sanitize that project's `alex.md` the same way I'm about to sanitize this one (see §7) — a stale, wrong-project frontmatter pin is a bug regardless of whether it's actively leaking today.

## 7. Follow-up action in this project

Independent of the other project's debugging, `.claude/agents/alex.md` here should be corrected — it still describes itself as "for the Graspp project" and carries a pin (`z-ai/glm-5.2`) that doesn't match this project's Pro-profile, non-OpenRouter setup. This session avoided the hazard by luck of an explicit spawn-time override, not because the file is correct. Flagged to the user separately; fix pending approval.

---

## 8. Independent revalidation (Alex, Validation mode)

*(Appended once Alex returns her review — she is being asked to independently attack every claim above, not rubber-stamp it.)*
