#!/usr/bin/env bash
# One-time script: redact MongoDB credentials from all git history.
# Run from repo root in Git Bash: bash scripts/sanitize-history.sh
# Takes a long time (~2–3 hours for 2700+ commits). After: git push --force-with-lease.
#
# Faster option: use BFG (Java required). See docs/SANITIZE_GIT_HISTORY.md

set -e
cd "$(git rev-parse --show-toplevel)"

# Clean up any previous incomplete run
rm -rf .git-rewrite

# Redact in every blob that contains the secrets (tree-filter runs per commit)
export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --tree-filter '
  git ls-files -z | while IFS= read -r -d "" f; do
    if [ -f "$f" ]; then
      if grep -q "Aezlf1N3Z568EwL9\|fg2E8I10Pnx58gYP" "$f" 2>/dev/null; then
        sed -i.bak -e "s/Aezlf1N3Z568EwL9/********/g" -e "s/fg2E8I10Pnx58gYP/********/g" "$f" 2>/dev/null || true
        rm -f "$f.bak" 2>/dev/null || true
      fi
    fi
  done
' --tag-name-filter cat -- --all

# Prune refs and gc so old objects are removed
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "History sanitized. Run: git push --force-with-lease origin main"
echo "Other clones must re-clone or rebase onto the new history."
