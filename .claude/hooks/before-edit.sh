#!/bin/bash
# Hook: before-edit
# Description: Runs before Claude edits a file
# Environment: FILE_PATH is available

# Create backups before editing files
if [ -f "$FILE_PATH" ]; then
  # Create backup directory
  BACKUP_DIR=".claude/backups"
  mkdir -p "$BACKUP_DIR"

  # Create backup with timestamp
  TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
  RELATIVE_PATH="${FILE_PATH#./}"
  BACKUP_FILE="$BACKUP_DIR/$(basename "$RELATIVE_PATH")_$TIMESTAMP.bak"

  # Copy file to backup
  cp "$FILE_PATH" "$BACKUP_FILE"

  # Keep only last 10 backups per file
  ls -t "$BACKUP_DIR"/$(basename "$RELATIVE_PATH")_*.bak 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
fi

exit 0
