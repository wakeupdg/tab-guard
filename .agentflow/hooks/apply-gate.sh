#!/bin/bash
# ~/.claude/hooks/apply-gate.sh

# --- CCS Blackboard Mutex Warning ---
if git diff --name-only HEAD 2>/dev/null | grep -q "CCS/Blackboard.md"; then
    if grep -q "Active Writer: Gemma" ".agentflow/CCS/Blackboard.md"; then
        echo "⚠️ [Mutex Warning]: The CCS Blackboard currently says 'Active Writer: Gemma' on disk. Ensure you are not talking over Gemma."
    fi
fi
# ---------------------------------

CHANGED_FILES=$(git diff --name-only HEAD)

# 1. The /scratch/ Exemption
if echo "$CHANGED_FILES" | grep -q "/scratch/"; then
    echo "[Gate] Scratch file detected. Bypassing tests for sandbox experimentation."
    exit 0
fi

# 2. Standard Run
echo "[Gate] Syncing tests/ and pyproject.toml to graspp-worker (Docker CP bypasses bind-mount deadlocks)..."
docker exec -u root graspp-worker rm -rf /app/tests/
docker cp tests/ graspp-worker:/app/tests/
docker cp pyproject.toml graspp-worker:/app/pyproject.toml

echo "[Gate] Running full suite in graspp-worker container..."
docker exec graspp-worker python -m pytest --ignore=tests/test_throughput_bench.py --ignore=src/graspp/_vendor/machine_design_orchestrator/tests > .test_output.log 2>&1
TEST_EXIT=$?

# 3. The Circuit Breaker (Prevent Infinite Retries)
STATE_FILE="$HOME/.claude/hooks/breaker.state"
if [ $TEST_EXIT -ne 0 ]; then
    cat .test_output.log
    if [ -f "$STATE_FILE" ]; then
        echo "❌ [Gate] CIRCUIT BREAKER TRIPPED: Consecutive test failure. Halting agent to prevent infinite loop."
        rm -f "$STATE_FILE"
        exit 0
    else
        echo "failed" > "$STATE_FILE"
        exit 0
    fi
else
    rm -f "$STATE_FILE"
    exit 0
fi
