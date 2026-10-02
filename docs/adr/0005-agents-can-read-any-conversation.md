# ADR-0005: Agents can read any issue and its conversation
Date: 2026-09-30 · Status: Accepted
Deciders: Alex Grozav (Operator) · Resolves: deck open question “Should agents read the conversations on sibling issues?”
Supersedes: — · Superseded by: —

## Context
Agents need context beyond their own issue: sibling contracts, prior decisions, related discussions. Limiting reads to the assigned issue would force people to copy context by hand.

## Decision
We will let agents read any issue and its conversation in the workspace they run in. Writes remain scoped to their run.

## Consequences
- Good: agents find decisions and contracts themselves; the context cascade can pull from anywhere; fewer steering comments are needed.
- Bad: a larger surface for prompt injection, since any comment can reach any agent. Private discussions need a different mechanism (a restricted project, or notes kept outside UDAX). Sensitive content in comments is readable by all agents in the workspace.
- Neutral: red-team tests for injection through cross-issue reads are part of M9.

## Revisit triggers
- A customer needs per-issue confidentiality inside one workspace.
