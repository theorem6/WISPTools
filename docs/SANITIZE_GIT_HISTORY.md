# Sanitizing Git History (MongoDB Credentials)

Older commits in this repo once contained hardcoded MongoDB Atlas passwords. They have been removed from the **current** tree; to remove them from **history** you must rewrite the repo and force-push.

## Option A: BFG Repo-Cleaner (recommended, much faster)

1. **Install Java** if needed (BFG is a JAR).

2. **Download BFG** (e.g. [releases](https://github.com/rtyley/bfg-repo-cleaner/releases)):
   - Get `bfg-1.15.0.jar` (or latest) and put it in the repo as `scripts/bfg.jar`.

3. **Run from repo root** (replace path to bfg.jar if different):
   ```powershell
   cd C:\Users\david\Downloads\WISPTools
   java -jar scripts\bfg.jar --replace-text scripts\bfg-replacements.txt .
   ```

4. **Clean up and GC**:
   ```powershell
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

5. **Force-push** (coordinate with anyone else who uses the repo):
   ```powershell
   git push --force-with-lease origin main
   ```

The file `scripts/bfg-replacements.txt` lists the two credential strings and their redaction (`********`).

## Option B: git filter-branch (no extra tools, slow)

From **Git Bash** (not PowerShell), from the repo root:

```bash
bash scripts/sanitize-history.sh
```

This rewrites every commit (can take ~2–3 hours for 2700+ commits). When it finishes, run the same `reflog expire`, `git gc`, and `git push --force-with-lease` as in Option A.

## After rewriting

- **Rotate the MongoDB Atlas passwords** (Database Access in Atlas) so any copy of the old credentials is useless.
- Anyone with a clone should either **re-clone** or **rebase** onto the new history; normal pull will not work after a force-push.
