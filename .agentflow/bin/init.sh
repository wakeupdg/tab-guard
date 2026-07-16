#!/bin/bash
echo "Initializing AgentFlow..."
mkdir -p Plans/Dispatch Plans/Resolved Handoffs 'Open Items/Closed'
touch 'Open Items.md'
mkdir -p ~/.claude/hooks
ln -sf "$PWD/.agentflow/hooks/apply-gate.sh" ~/.claude/hooks/apply-gate.sh
echo "AgentFlow Ready."
