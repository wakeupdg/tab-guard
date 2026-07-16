#!/usr/bin/env bash
# audio-notify.sh — Antigravity hook to play a sound when ask_question is called.
set -uo pipefail

state_file="$HOME/.audio_notifications_enabled"
if [[ -f "$state_file" ]]; then
    state=$(cat "$state_file")
    if [[ "$state" == "1" ]]; then
        afplay /System/Library/Sounds/Glass.aiff &
    fi
fi

# Antigravity hooks expect a simple decision block for PreToolUse
echo '{"decision": "allow", "reason": "Audio notification processed"}'
exit 0
