# Architecture decision records

ADRs record decisions that were actually made: who made them, why, and what they cost. They are append-only. To change a decision, write a new ADR that supersedes it. Proposals under discussion live in [`../rfc`](../rfc/README.md).

| # | Title | Date | Status | Tags |
|---|---|---|---|---|
| [0001](0001-standalone-agent-agnostic-engine.md) | The engine is standalone and agent-agnostic | 2026-09-30 | Accepted | architecture, adapters |
| [0002](0002-ui-and-cli-are-engine-interfaces.md) | The UI and the CLI are interfaces to the engine | 2026-09-30 | Accepted | architecture, api |
| [0003](0003-linear-inspired-visual-language.md) | The product UI follows a Linear-inspired visual language | 2026-09-30 | Accepted | design |
| [0004](0004-one-owner-many-assignees.md) | Every issue has one owner and any number of assignees | 2026-09-30 | Accepted | domain |
| [0005](0005-agents-can-read-any-conversation.md) | Agents can read any issue and its conversation | 2026-09-30 | Accepted | agents, security |
| [0006](0006-cli-conventions-follow-multica.md) | The CLI follows noun-verb grammar and conventions adapted from Multica | 2026-09-30 | Accepted | cli |
| [0007](0007-steering-through-the-issue-conversation.md) | People steer agents through the issue’s conversation | 2026-09-30 | Accepted | agents, ux |
| [0008](0008-agents-are-configured-by-prompt-model-effort.md) | Agents are configured by a versioned prompt, a model, and an effort level | 2026-09-30 | Accepted | agents |
