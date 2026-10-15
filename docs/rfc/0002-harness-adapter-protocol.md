# RFC-0002: How should harnesses connect to the engine?
Status: In review
Author: Claude (for Alex Grozav) · Reviewers: Alex Grozav · Class: 3 · Comment window closes: 2026-10-05

## Problem
ADR-0001 makes the engine agent-agnostic: any harness (Claude Code, Codex, Gemini CLI, OpenCode, in-house agents) must work through an adapter. The engine needs a way to start a session in a worktree, send context and steering, receive streaming progress (messages, tool calls, plans), gate sensitive actions through the policy engine, observe or mediate file writes (claims, collisions, human edit locks), own terminals (live view, take over), cancel and resume, and learn usage and cost.

The wire protocol chosen here determines how many harnesses work on day one and how much adapter code the team maintains.

## Options considered

### Option A: ACP first (the engine is an ACP client) behind an internal trait
The Agent Client Protocol (JSON-RPC 2.0 over stdio, v1 stable) was designed for editors driving coding agents. The engine plays the editor’s role: `initialize` with client capabilities (`fs`, `terminal`), `session/new` with a cwd and `mcpServers`, `session/prompt`, streamed `session/update` notifications (message and thought chunks, tool calls, plans), `session/request_permission`, `fs/read_text_file` and `fs/write_text_file`, `terminal/*`, `session/cancel`, and `session/load`.
- **For**: an existing, growing ecosystem. Gemini CLI speaks ACP natively, and ACP adapters exist for Claude Code and Codex. Nearly every UDAX need maps directly: permissions become policy decisions, client FS gives file mediation, client terminals give live PTYs, and `mcpServers` lets the engine inject the UDAX MCP server. There are official SDKs in Rust, TypeScript, and Python for in-house agents. A standard protocol lowers the cost of every new harness.
- **Costs**: the protocol is shaped around interactive editor sessions, not headless batch runs. Some needs (usage and cost, evidence hints) require extension points (`_meta`, extension methods) or harness-specific handling. Adapters for harnesses without native ACP depend on third parties.
- **Risks**: protocol churn, and adapters lagging harness releases.

### Option B: A bespoke UDAX harness protocol
A JSON-RPC protocol designed for headless runs: `run/start{context_pack, budget}`, `run/event`, `run/result`, `run/cancel`.
- **For**: exactly fits UDAX semantics (budgets, evidence, requests); fully under our control; stable.
- **Costs**: no harness implements it, so every harness needs a custom adapter, and we maintain all of them. The ecosystem is not helped.
- **Risks**: becomes a private island; permanent maintenance load.

### Option C: Native SDK integrations per harness
Link each harness’s own SDK (for example the Claude Agent SDK, the Codex SDK) directly.
- **For**: the richest feature access per harness (subagents, hooks, detailed usage).
- **Costs**: N integrations inside the engine, some tied to specific languages (TS or Python SDKs in a Rust engine means sidecars), and upgrades that follow each vendor’s cadence.
- **Risks**: the engine becomes coupled to vendors, against the spirit of ADR-0001.

## Trade-off summary
| | A: ACP first | B: Bespoke | C: Native SDKs |
|---|---|---|---|
| Harnesses working at launch | **Many** | Few (each needs work) | Few (each needs work) |
| Fit to UDAX needs | Very good (plus extensions) | **Best** | Very good per harness |
| Maintenance load | **Low** | High | Highest |
| Vendor coupling | **Low** | Low | High |
| Reversibility | Medium (the trait isolates it) | Medium | Low |

## Recommendation
**Option A**, behind an internal `HarnessAdapter` trait so B-style or C-style adapters can still be added for specific harnesses when a feature demands it. In addition, agents act on the system through the run-scoped `udax` CLI and the UDAX MCP server, not through ACP. ACP carries the session; UDAX’s own verbs travel over UDAX’s interfaces. A generic headless adapter covers CLIs that have neither ACP nor an SDK.

**The strongest argument against**: ACP is editor-oriented, and some harness adapters are maintained by third parties. If an important harness’s ACP adapter lags or omits features (usage reporting, resume), UDAX inherits the gap. The mitigations are the trait (so a native adapter can replace one ACP path), a nightly conformance suite, and upstream contributions.

## Open questions
- Which three harnesses are Tier 1 at M6? Default: Claude Code, Codex, Gemini CLI. Owner: Operator. Resolve by the start of M6.
- Can usage and cost be standardized through ACP extensions with upstream maintainers? Owner: adapters lead. Resolve by M9.

## Decision log
Pending.
