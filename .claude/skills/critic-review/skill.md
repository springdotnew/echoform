---
name: critic-review
description: "Spawn 6 critic agents (3 code quality, 3 security) to review recent changes, validate all claims, and present findings. Triggers on: critic review, review critics, spawn critics, code review agents, security review agents."
---

# Critic Review

Spawn parallel critic agents to review code changes, validate their findings, and present actionable results.

---

## The Job

1. **Identify changed files** from the current branch vs base
2. **Spawn 6 critic agents** in parallel (3 code quality, 3 security)
3. **Collect and deduplicate** all findings
4. **Validate each claim** by reading the actual code
5. **Present validated findings** grouped by severity

---

## Step 1: Identify Changed Files

Determine what files to review:

```bash
# Get the diff of changed files
git diff --name-only HEAD~$(git rev-list --count HEAD --not $(git merge-base HEAD master))..HEAD 2>/dev/null || git diff --name-only HEAD~3..HEAD
```

If the user specifies particular files or directories, scope the review to those instead.

Read all changed files so you can provide them as context to the critic agents.

---

## Step 2: Spawn Critic Agents

Launch **6 agents in parallel** using the Agent tool. All agents should receive:
- The full content of each changed file
- The diff showing what changed

### Code Quality Critics (3 agents)

Each code quality critic should focus on a different area. Read the project's coding rules from `docs/coding-rules.md` and include them in the agent prompt.

**Agent 1 — Structure & Patterns:**
- Zero mutation violations
- Nested if statements (must be zero)
- Function size (≤20 lines)
- Single responsibility principle
- Classes (must not exist — functional only)

**Agent 2 — Types & Naming:**
- `any` type usage
- Descriptive variable/function names
- Strict interfaces
- Reuse of existing types
- Boolean function naming (is/has/can/should prefixes)

**Agent 3 — Code Hygiene:**
- DRY violations
- Comments explaining "what" instead of "why"
- Error handling patterns
- Dead code
- Dependency inversion

### Security Critics (3 agents)

**Agent 4 — Input Validation & Injection:**
- Input validation at system boundaries
- Prototype pollution vectors
- Injection risks (command, XSS, etc.)
- Unsafe type assertions that skip validation

**Agent 5 — Auth & Access Control:**
- Authentication bypass vectors
- Authorization check completeness
- Token/credential handling
- Session management
- Event authorization gaps

**Agent 6 — Transport & Protocol Security:**
- WebSocket security (origin checks, message validation)
- Binary protocol parsing safety
- Error message information leakage
- CORS configuration
- Race conditions in connection/disconnection handling

### Agent Prompt Template

Each agent prompt MUST include:

```
You are a critic reviewing code changes. Your job is to find REAL issues, not theoretical ones.

**Rules:**
- Only report issues in the CHANGED code (not pre-existing issues)
- Each finding must reference a specific file and line number
- Each finding must include the actual problematic code snippet
- Rate severity: HIGH (exploitable/broken), MEDIUM (should fix), LOW (nice to have)
- Do NOT report issues that are by design or documented trade-offs
- Be specific — "could be improved" is not a finding

**Output format for each finding:**
### [SEVERITY] Title
- **File:** path/to/file.ts:LINE
- **Code:** `the problematic code`
- **Issue:** What's wrong
- **Fix:** How to fix it
```

---

## Step 3: Collect and Deduplicate

After all 6 agents complete:

1. Gather all findings into a single list
2. Remove exact duplicates (same file, same line, same issue)
3. Merge similar findings that point to the same root cause
4. Sort by severity: HIGH → MEDIUM → LOW

---

## Step 4: Validate Each Claim

For every finding, **read the actual code** at the referenced location and verify:

1. Does the file and line exist?
2. Does the code snippet match what's actually there?
3. Is the issue real or a false positive?
4. Is this a change we made, or pre-existing code?

Mark each finding as:
- **CONFIRMED** — Issue is real and in changed code
- **FALSE POSITIVE** — Code is correct, critic was wrong (explain why)
- **PRE-EXISTING** — Real issue but not in our changes
- **BY DESIGN** — Intentional trade-off (explain rationale)

---

## Step 5: Present Results

Show the user a summary table:

```
## Critic Review Results

### Summary
- Total findings: X
- Confirmed: X (Y high, Z medium, W low)
- False positives: X
- Pre-existing: X
- By design: X

### Confirmed Findings

#### HIGH
[List each confirmed HIGH finding with file, line, issue, and suggested fix]

#### MEDIUM
[List each confirmed MEDIUM finding]

#### LOW
[List each confirmed LOW finding]

### Dismissed Findings
[Brief list of false positives / pre-existing / by-design with one-line explanations]
```

---

## Important Notes

- **Do NOT fix anything** — this skill only reports. The user decides what to fix.
- **Validate before presenting** — never show unvalidated claims to the user.
- **Scope to changes** — pre-existing issues should be noted but clearly labeled.
- If a critic agent fails or returns no results, note it in the summary.
- Use `subagent_type: "general-purpose"` for all critic agents.
