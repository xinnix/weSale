#!/bin/bash
# Hook: Type Check Guard
# Triggers incremental type checking after editing TS/TSX files in apps/ or infra/
# Environment: FILE_PATH is available

# Only check TS/TSX files in apps/ or infra/
if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]]; then
  exit 0
fi

if [[ "$FILE_PATH" != apps/* && "$FILE_PATH" != infra/* ]]; then
  exit 0
fi

# Skip type declaration files and generated files
if [[ "$FILE_PATH" == *.d.ts || "$FILE_PATH" == *node_modules/* || "$FILE_PATH" == *generated/* ]]; then
  exit 0
fi

# Incremental check: only check the project containing the modified file
if [[ "$FILE_PATH" == apps/api/* ]]; then
  RESULT=$(cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20)
elif [[ "$FILE_PATH" == apps/admin/* ]]; then
  RESULT=$(cd apps/admin && npx tsc --noEmit --pretty 2>&1 | head -20)
elif [[ "$FILE_PATH" == apps/miniapp/* ]]; then
  RESULT=$(cd apps/miniapp && npx tsc --noEmit --pretty 2>&1 | head -20)
elif [[ "$FILE_PATH" == infra/shared/* ]]; then
  RESULT=$(cd infra/shared && npx tsc --noEmit --pretty 2>&1 | head -20)
elif [[ "$FILE_PATH" == infra/database/* ]]; then
  RESULT=$(cd infra/database && npx tsc --noEmit --pretty 2>&1 | head -20)
fi

if [ -n "$RESULT" ]; then
  echo "⚠️ Type check issues detected after editing $FILE_PATH:"
  echo "$RESULT"
fi

exit 0
