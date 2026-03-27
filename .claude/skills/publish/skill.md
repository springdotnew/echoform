---
name: publish
description: "Read changes since last release, create a changeset, push, merge the Version Packages PR, and publish all packages to npm via CI. Triggers on: publish, release, deploy packages, new version, patch release."
---

# Publish Packages

Automate the full release cycle: read changes, create changeset, push, merge Version Packages PR, and confirm npm publish.

---

## Step 1: Read Changes Since Last Release

Find the last Version Packages commit and show what changed:

```bash
# Find the last "Version Packages" commit
LAST_RELEASE=$(git log --oneline --all --grep="Version Packages" -1 --format="%H")
git log --oneline "$LAST_RELEASE..HEAD"
```

If there are no new commits since the last release, tell the user there's nothing to publish and stop.

Show the user the list of commits and a brief summary of what changed.

---

## Step 2: Create Changeset

Determine which packages need to be included. The publishable packages are:

- `@playfast/echoform`
- `@playfast/echoform-render`
- `@playfast/echoform-bun-ws-client`
- `@playfast/echoform-bun-ws-server`
- `@playfast/echoform-socket-client`
- `@playfast/echoform-socket-server`
- `@playfast/wmux`
- `@playfast/wmux-client-terminal`

Check if any new publishable packages have been added to `packages/` or `plugins/` that aren't in this list. If so, also add them to `scripts/resolve-workspace-deps.js`.

Write a changeset file at `.changeset/<descriptive-name>.md`:

```markdown
---
"@playfast/echoform": patch
"@playfast/echoform-render": patch
"@playfast/echoform-bun-ws-client": patch
"@playfast/echoform-bun-ws-server": patch
"@playfast/echoform-socket-client": patch
"@playfast/echoform-socket-server": patch
"@playfast/wmux": patch
"@playfast/wmux-client-terminal": patch
---

<One-line summary of changes>
```

Default to `patch` bump. If the user says "minor" or "major", use that instead.

---

## Step 3: Commit and Push

```bash
git add .changeset/ scripts/resolve-workspace-deps.js
git commit -m "Add changeset for patch release

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push origin master
```

---

## Step 4: Wait for Version Packages PR

The Release workflow (`release.yml`) runs on push to master. When changesets exist, it creates a "Version Packages" PR.

```bash
# Wait for the release workflow to finish
gh run list --workflow=release.yml --limit 1
gh run watch <RUN_ID> --exit-status
```

---

## Step 5: Merge Version Packages PR

```bash
gh pr list --head changeset-release/master --json number -q '.[0].number'
gh pr merge <PR_NUMBER> --squash
```

---

## Step 6: Wait for Publish and Confirm

Merging triggers the release workflow again. This time (no changesets present) it publishes to npm.

```bash
# Watch the publish workflow
gh run list --workflow=release.yml --limit 1
gh run watch <RUN_ID> --exit-status

# Confirm what was published
gh run view <RUN_ID> --log 2>/dev/null | grep -E '(being published|success packages)' | head -15
```

---

## Step 7: Pull and Report

```bash
git pull origin master
```

Show the user a table of all published packages with their new versions.

---

## Important Notes

- Always use `--squash` when merging the Version Packages PR.
- If the release workflow fails, check the logs with `gh run view <ID> --log` and report the error.
- Do NOT attempt to publish locally with `npm publish` — always go through the CI workflow.
- If `resolve-workspace-deps.js` needs updating for new packages, commit that change along with the changeset.
