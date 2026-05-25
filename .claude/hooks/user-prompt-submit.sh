#!/bin/bash
# Hook: UserPromptSubmit
# Description: Runs when user submits a prompt
# Input: JSON via stdin with "prompt" field

LOG_DIR=".claude/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/prompts.log"

# Read JSON from stdin
INPUT_JSON=$(cat)

# Extract the prompt field using grep/sed (basic JSON parsing)
PROMPT=$(echo "$INPUT_JSON" | grep -o '"prompt"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"prompt"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# Write to log with timestamp
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"
if [ -n "$PROMPT" ]; then
  echo "$PROMPT" >> "$LOG_FILE"
else
  echo "[Failed to extract prompt from JSON]" >> "$LOG_FILE"
  echo "[Raw input: $INPUT_JSON]" >> "$LOG_FILE"
fi
echo "" >> "$LOG_FILE"

# Keep log file size manageable (max 1000 lines)
if [ $(wc -l < "$LOG_FILE" 2>/dev/null || echo 0) -gt 1000 ]; then
  tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

exit 0
