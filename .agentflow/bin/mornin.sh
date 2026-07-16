#!/bin/bash
# Hard Requirement: Explicitly enable and confirm Narrate and Fable before anything else.
echo "✅ Narrate skill enabled — Forces the AI to transparently narrate its internal thought process and state changes to the user."
echo "on" > "$HOME/.claude/narrate_state" 2>/dev/null || true

echo "✅ Fable execution mode enabled — Activates Fable 5 reasoning protocols for deep logic derivation and adversarial verification."
echo "on" > "$HOME/.claude/fable_state_cory" 2>/dev/null || true
echo "on" > "$HOME/.claude/fable_state_gemma" 2>/dev/null || true
echo ""

# Common staging logic for Antigravity (Gemma)
stage_gemma() {
    echo "Staging Gemma's active-persona.md..."
    mkdir -p .agents/rules
    cp .agentflow/personas/gemma.md .agents/rules/active-persona.md
}

AGENTFLOW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$1" == "team" ]; then
    echo "Launching AgentFlow Dual-Window..."
    stage_gemma
    TMP_SCRIPT=$(mktemp)
    cat <<EOF > "$TMP_SCRIPT"
#!/bin/bash
cd "$PWD"
claude -p "\$(bash "$AGENTFLOW_DIR/personas/cory.sh")"
rm "\$0"
EOF
    chmod +x "$TMP_SCRIPT"
    osascript -e "tell application \"Terminal\" to do script \"bash '$TMP_SCRIPT'\""
    exec agy
elif [ "$1" == "gemma" ]; then
    stage_gemma
    exec agy
elif [ "$1" == "cory" ]; then
    if [ -n "$CLAUDECODE" ]; then
        echo "Already inside a Claude Code session (CLAUDECODE=1) — skipping nested claude subprocess."
    else
        exec claude -p "$(bash "$AGENTFLOW_DIR/personas/cory.sh")"
    fi
else
    echo "AgentFlow Error: Please specify a persona. Usage: mornin <team|cory|gemma>"
    exit 1
fi
