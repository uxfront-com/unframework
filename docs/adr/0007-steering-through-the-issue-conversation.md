# ADR-0007: People steer agents through the issue’s conversation
Date: 2026-09-30 · Status: Accepted
Deciders: Alex Grozav (Operator) · Informed by: deck slides 19–20
Supersedes: — · Superseded by: —

## Context
Chat windows lose context and leave no record attached to the work. Steering should be durable, attributable, and reviewable.

## Decision
We will make comments on the issue the way people steer agents. A steer comment to an assignee becomes a request with a status. Agents reply in the thread with what they changed. A Note toggle posts without starting work.

## Consequences
- Good: every instruction and answer is part of the issue record; requests are trackable to commits; decisions can be promoted into context.
- Bad: comments are slower than a chat for quick back-and-forth, so the composer and agent replies must be fast. Threads can grow long, which needs good folding and search.
- Neutral: ACP permission requests surface as asks in the same thread.

## Revisit triggers
- People repeatedly ask for an ephemeral chat outside issues (Multica offers one, for example).
