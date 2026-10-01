# ADR-0006: The CLI follows noun-verb grammar and conventions adapted from Multica
Date: 2026-09-30 · Status: Accepted
Deciders: Alex Grozav (Operator) · Informed by: Multica CLI docs (multica.ai/docs/cli)
Supersedes: — · Superseded by: —

## Context
Agents call the CLI constantly, and people script it. A predictable grammar lets both guess the next command. Multica’s CLI is a strong reference for an agent-facing issue CLI.

## Decision
We will use `udax <noun> <verb> [KEY] [flags]` with these conventions: issue keys instead of internal IDs (`--full-id` when needed); tables for `list` and JSON for `get`, switchable with `--output`; name resolution with `--to` plus `--to-id`; long text through `--content-stdin` and `--content-file`; announced side effects with `--note` and `--no-start`; run-scoped tokens that refuse human-only commands; errors with a stable code and a remedy.

## Consequences
- Good: learnable, scriptable, and friendly to agents; familiar to Multica users.
- Bad: noun-verb commands are longer to type than bespoke verbs (`udax issue comment add` versus `udax comment`). Aliases may be needed for people.
- Neutral: JSON output shapes are a versioned contract with published schemas.

## Revisit triggers
- Usage data shows people mostly using aliases, or agents misusing commands in ways grammar changes would prevent.
