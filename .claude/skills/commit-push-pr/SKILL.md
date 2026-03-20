---
name: commit-push-pr
description: Automate git workflow for commits and PR management. Use when committing changes, organizing commit history, or managing existing PRs.
disable-model-invocation: true
allowed-tools: Bash
---

# Commit, Push, and PR Command

Automate the git workflow for this repository.

## Workflow

Execute the following steps in order:

### Step 1: Verify Branch

1. Run `git branch --show-current` to get the current branch name
2. If on `main` branch, stop and inform the user:
   - "You are on the main branch. Please create a feature branch first using `git checkout -b <branch-name>`"

### Step 2: Check for Changes

1. Run `git status --porcelain` to check for uncommitted changes
2. Run `git diff` and `git diff --staged` to understand the changes
3. If no changes exist, inform the user: "No changes to commit."

### Step 3: Check PR Status

1. Run `gh pr view --json state,url 2>/dev/null` to check if a PR exists for this branch
2. Note the result for the next step

### Step 4: Execute Based on PR Status

#### If NO PR exists:

1. Check if there are any commits ahead of main: `git log main..HEAD --oneline`
2. If there are uncommitted changes:
   - Group changes by logical units (same rules as "If PR already exists" section)
   - **Never use `git add .`** - always specify files explicitly
3. **User Confirmation for Commits:**
   - Draft commit message(s) based on the changes
   - Present the proposed commit plan to the user (files to stage + commit message for each)
   - Use `AskUserQuestion` tool to let user confirm, edit, reject, or **split further**
   - If user chooses "Split further", re-analyze the changes and propose a more granular commit plan
   - Only proceed with `git add` and `git commit` after user approval
4. **Do NOT push** - inform user they can use `/create-update-pr` when ready to push and create PR

#### If PR already exists:

1. Analyze the current state:
   - `git status` - check uncommitted changes
   - `git log main..HEAD --oneline` - review existing commits in this PR
   - `git diff` - understand the new changes

2. **Decide: Create new commit OR reorganize with reset?**

   **Create new commit when:**
   - New changes are a distinct, complete logical unit
   - New changes are unrelated to existing commits
   - Example: Added a new feature, now adding documentation

   **Use `git reset` to reorganize when:**
   - New changes belong to an existing commit's logical unit
   - Existing commits are messy/fragmented and need cleanup
   - Want to squash multiple small commits into one meaningful commit
   - Example: Fixed a typo in code you just committed

3. **If reorganizing with reset:**

   ```bash
   # Soft reset to keep changes staged
   git reset --soft main

   # Or reset to a specific commit
   git reset --soft <commit-hash>

   # Then create clean, logical commits
   git add <specific-files>
   git commit -m "meaningful message"

   # Force push (required after reset)
   git push --force-with-lease
   ```

4. **If creating new commit(s):**
   - Group changes by logical units
   - Stage specific files: `git add <files>` (never `git add .`)
   - Write focused commit message

5. **User Confirmation for Commits:**
   - Present the proposed commit plan to the user (files to stage + commit message for each)
   - If reorganizing, also show the reset strategy and resulting commit structure
   - Use `AskUserQuestion` tool to let user confirm, edit, reject, or **split further**
   - If user chooses "Split further", re-analyze the changes and propose a more granular commit plan
   - Only proceed with `git add` and `git commit` after user approval

6. **User Confirmation for Push:**
   - After commits are done, ask user if they want to push now
   - Use `AskUserQuestion` with options: "Push now" / "Don't push yet"
   - Only push if user approves

7. Execute the approved git commands (push only if confirmed)

8. Output the result to user

**IMPORTANT: Clean Commit History Principles**

- PR commits should tell a **story** - easy to read and understand
- Each commit = one complete, logical change
- Don't commit every tiny change - wait for meaningful units
- Use `git reset` freely to reorganize unpushed commits
- Use `git reset --soft` + `git push --force-with-lease` for pushed commits

**Commit Message Format (Conventional Commit):**

```
<type>(<scope>): <subject>
```

- **type**: `new` | `feat` | `fix` | `refactor` | `chore` | `test` | `docs`
- **scope**: Optional, affected area (e.g., `ai-bu`, `jutor-api`, `auth`, `chat`)
- **subject**: English, max 50 words, imperative mood (e.g., "add", "fix", "update")
- **IMPORTANT**: Do NOT add `Co-Authored-By` lines to commit messages

**Example: Reorganizing Messy Commits**

```
# Current messy state:
abc123 chore: update settings
def456 fix: typo in command
ghi789 docs: add grouping rules
jkl012 chore: remove co-author

# These are all related to one feature - reorganize!
git reset --soft main
git add .claude/commands/commit-push-pr.md
git commit -m "new(claude): add commit-push-pr command for automated git workflow"
git add .claude/settings.local.json
git commit -m "chore(claude): add required bash permissions for git commands"
git push --force-with-lease

# Clean result:
abc123 new(claude): add commit-push-pr command for automated git workflow
def456 chore(claude): add required bash permissions for git commands
```
