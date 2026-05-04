#!/bin/bash
#
# Pre-commit check: Ensure CREATE POLICY statements in migrations
# have a corresponding DROP POLICY IF EXISTS in the same file,
# OR are net-new policies (not defined in any prior migration).
#
# Exit 0 = all good, Exit 1 = violations found.

MIGRATIONS_DIR="supabase/migrations"

# Get staged .sql files under supabase/migrations/
STAGED_SQL=$(git diff --cached --name-only --diff-filter=ACM | grep "^${MIGRATIONS_DIR}/.*\.sql$")

if [ -z "$STAGED_SQL" ]; then
  exit 0
fi

# Extract policy name and table from a file, handling both single-line and multi-line formats:
#   CREATE POLICY "name" ON table ...
#   CREATE POLICY "name"\n  ON table ...
# Outputs lines of: policy_name<TAB>table_name
extract_policies() {
  local file="$1"
  awk '
    /[Cc][Rr][Ee][Aa][Tt][Ee] +[Pp][Oo][Ll][Ii][Cc][Yy]/ {
      line = $0
      if (line !~ /[Oo][Nn] +[^ ]/) {
        getline nextline
        line = line " " nextline
      }
      # Extract policy name (between quotes) and table name (after ON)
      if (match(line, /[Cc][Rr][Ee][Aa][Tt][Ee] +[Pp][Oo][Ll][Ii][Cc][Yy] +"([^"]+)"/, pn) && match(line, /[Oo][Nn] +([^ ;(]+)/, tn)) {
        print tolower(pn[1]) "\t" tolower(tn[1])
      }
    }
  ' "$file"
}

# Collect the earliest staged file basename for determining "prior" cutoff
# Build a sorted list of staged basenames
STAGED_BASENAMES=""
EARLIEST_STAGED=""
for FILE in $STAGED_SQL; do
  BN=$(basename "$FILE")
  STAGED_BASENAMES="$STAGED_BASENAMES $BN"
  if [ -z "$EARLIEST_STAGED" ] || [[ "$BN" < "$EARLIEST_STAGED" ]]; then
    EARLIEST_STAGED="$BN"
  fi
done

# Build a single index of ALL policies in ALL prior migration files (before the earliest staged file).
# This runs once instead of once-per-policy-per-file.
PRIOR_POLICY_INDEX=$(mktemp)
trap "rm -f '$PRIOR_POLICY_INDEX'" EXIT

for PRIOR_FILE in $(ls "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | sort); do
  PRIOR_BN=$(basename "$PRIOR_FILE")
  # Stop before the earliest staged file
  if [[ "$PRIOR_BN" > "$EARLIEST_STAGED" ]] || [ "$PRIOR_BN" = "$EARLIEST_STAGED" ]; then
    break
  fi
  extract_policies "$PRIOR_FILE"
done > "$PRIOR_POLICY_INDEX"

VIOLATIONS=0

for FILE in $STAGED_SQL; do
  if [ ! -f "$FILE" ]; then
    continue
  fi

  while IFS=$'\t' read -r POLICY_NAME TABLE_NAME; do
    if [ -z "$POLICY_NAME" ] || [ -z "$TABLE_NAME" ]; then
      continue
    fi

    # Check 1: Does a DROP POLICY IF EXISTS for this name+table exist in the same file?
    if grep -qi "DROP POLICY IF EXISTS \"${POLICY_NAME}\" ON ${TABLE_NAME}" "$FILE" 2>/dev/null; then
      continue
    fi

    # Check 2: Is this policy defined in any prior migration? (lookup in pre-built index)
    if grep -qi "^${POLICY_NAME}	${TABLE_NAME}$" "$PRIOR_POLICY_INDEX" 2>/dev/null; then
      echo "❌ RLS POLICY ERROR in $FILE:"
      echo "   CREATE POLICY \"${POLICY_NAME}\" ON ${TABLE_NAME}"
      echo "   recreates an existing policy without DROP POLICY IF EXISTS."
      echo "   Add this line BEFORE the CREATE POLICY:"
      echo "   DROP POLICY IF EXISTS \"${POLICY_NAME}\" ON ${TABLE_NAME};"
      echo ""
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
    # If not found in any prior file, it's net-new — safe, skip.

  done < <(extract_policies "$FILE")
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Found $VIOLATIONS policy recreation(s) without DROP POLICY IF EXISTS."
  echo "Fix these before committing to prevent deployment failures."
  exit 1
fi

echo "✅ RLS policy migration check passed"
exit 0
