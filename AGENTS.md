# Agent Instructions

These instructions apply to the entire repository.

## Local work log

This project uses `/WORK_LOG.md` as a local, untracked handoff document for agents.

### Starting work

1. Before making changes, read:
   - `AGENTS.md`.
   - Committed requirements and architecture documents relevant to the task.
   - `WORK_LOG.md`, if it exists.
   - The current Git status and recent relevant commits, when the directory is a Git repository.
2. Verify the contents of `WORK_LOG.md` against the actual code and repository state. The work log provides context but is not an authoritative source.
3. Update the current objective, current status, and work-in-progress sections of `WORK_LOG.md` before beginning substantial implementation work.

### Maintaining the work log

Keep `WORK_LOG.md` concise and current. It should contain:

- The current objective and completion criteria.
- Current implementation status.
- Completed work.
- Work in progress and the next concrete action.
- Prioritized next steps.
- Blockers and open questions.
- Important temporary decisions and their reasoning.
- Verification performed and its results.
- Known issues.
- Recent relevant commit hashes and descriptions.

Update the work log after completing a meaningful unit of work, after creating a commit, and before handing work to another agent.

### Safety and source-of-truth rules

1. Never put secrets, credentials, access tokens, private keys, or connection strings in `WORK_LOG.md`.
2. Never stage or commit `WORK_LOG.md`.
3. Once Git has been initialized, ensure `/WORK_LOG.md` is locally excluded through `.git/info/exclude` rather than the repository's committed `.gitignore`.
4. Formal requirements, architecture decisions, setup instructions, and other long-lived information must be written to tracked project documentation. `WORK_LOG.md` must not be the only record of an important decision.
5. Before handing work off, ensure another agent can understand the current state, remaining work, and next action from `WORK_LOG.md`.

### Suggested work log structure

```markdown
# CupThings Work Log

Last updated: YYYY-MM-DD HH:mm
Current owner: agent/name

## Current objective

## Current status

## Completed

## In progress

## Next

## Decisions

## Blockers / Open questions

## Verification

## Known issues

## Recent commits
```
