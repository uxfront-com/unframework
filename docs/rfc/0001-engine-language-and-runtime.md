# RFC-0001: Which language and runtime should the engine and CLI use?
Status: In review
Author: Claude (for Alex Grozav) · Reviewers: Alex Grozav · Class: 3 · Comment window closes: 2026-10-05

## Problem
The engine is standalone (ADR-0001). It runs for hours on developer laptops and team servers, supervises many child processes (harnesses, dev servers, PTYs), manipulates git worktrees, serves HTTP and WebSocket traffic, and stores an event log. The CLI is called constantly, by people and especially by agents inside runs, so startup time and single-file distribution matter. The UI is TypeScript either way.

This choice is one-way: it shapes hiring, every crate or package boundary, the codegen strategy, and the desktop shell (RFC-0004).

Fixed constraints: the engine must run on macOS, Linux, and Windows; the CLI must install as one artifact; interfaces reach the engine only through its public API (ADR-0002).

## Options considered

### Option A: Rust for the engine and CLI, TypeScript for the UI
One `udax` binary (tokio, axum, sqlx, clap) contains the CLI, the daemon, and the server roles.
- **For**: CLI startup in low milliseconds and a zero-dependency install. That matters when an agent may call `udax` hundreds of times per run. Memory safety and predictable resource use for a long-running supervisor of processes and PTYs. First-class libraries for exactly this workload: portable-pty (from WezTerm), gix, notify, sqlx, the official ACP crate (`agent-client-protocol`), and the official MCP SDK (`rmcp`). It pairs naturally with Tauri 2 for desktop. Comparable tools went this way, for example Zed and Warp, and OpenAI’s Codex CLI moved from TypeScript to Rust in 2025.
- **Costs**: two languages; TS types generated from Rust (ts-rs, OpenAPI); slower compile and iteration; a smaller hiring pool; a learning curve for a TypeScript-heavy team.
- **Risks**: velocity in M1–M2 if the team is new to Rust. Mitigations: a pure `udax-domain` crate with no async or IO, paired reviews, and coding agents that are strong at Rust.

### Option B: TypeScript everywhere (Node 24 with Effect; CLI compiled with Bun)
The engine is a Node service written with Effect (typed errors, structured concurrency, dependency injection, schemas), and the CLI is a Bun-compiled single executable.
- **For**: one language and shared types with no codegen. The fastest iteration. The largest ecosystem for this domain: the Claude Agent SDK, the ACP and MCP TypeScript SDKs, Octokit, and Playwright are all native. Easiest for a TypeScript team and for contributors. Electron makes an easy desktop story. Comparable tools: Claude Code and OpenCode are TypeScript.
- **Costs**: CLI startup in the tens of milliseconds rather than single digits, and larger binaries (a bundled runtime). Native modules (node-pty) complicate cross-platform packaging. Higher memory for the daemon. Effect has a learning curve of its own.
- **Risks**: process supervision and PTY edge cases on Windows. Long-run memory behavior under many concurrent sessions.

### Option C: Go for the engine and CLI, TypeScript for the UI
- **For**: single static binaries, fast compiles, simple concurrency, and a large pool of infrastructure engineers. Good libraries for HTTP, SQL, and PTYs (creack/pty). Multica’s CLI and daemon follow a similar single-binary shape.
- **Costs**: a less expressive type system for a rich domain (state machines, policy tables, event upcasting); TS type generation is needed as in A; no Tauri synergy; the ACP and MCP SDKs are less mature than the Rust and TS ones.
- **Risks**: domain invariants enforced by convention rather than by types.

## Trade-off summary
| | A: Rust | B: TypeScript | C: Go |
|---|---|---|---|
| Delivery speed, first 3 months | Medium | **High** | Medium-high |
| CLI startup and distribution | **Best** | Good | **Best** |
| Long-running daemon robustness | **Best** | Good | Very good |
| Domain modeling (types, invariants) | **Best** | Very good (Effect) | Fair |
| Ecosystem for harnesses and protocols | Very good | **Best** | Fair |
| Desktop story | Tauri (natural) | Electron (natural) | Either (sidecar) |
| Operational cost (the 2 a.m. cost) | Low | Medium | Low |
| Reversibility | Low (one-way) | Low | Low |

## Recommendation
**Option A (Rust for the engine and CLI, TypeScript for the UI).** The engine is infrastructure: a supervisor, a store, and a scheduler that people and agents lean on all day. The CLI is its hottest path. Rust gives the best startup, distribution, and robustness, and the protocol crates we need are official. Codegen keeps the UI’s types exact.

**The strongest argument against**: velocity and team fit. If the team is primarily TypeScript and has no Rust reviewer, Option B ships M1–M4 faster and keeps every engineer productive on day one, and its costs (CLI startup around 20–40 ms, packaging native modules) are real but tolerable. If the Operator weighs early speed above long-run robustness, B is the right call. The rest of the plan is unchanged except for the §6.1 tool list and the RFC-0004 default (Electron).

## Open questions
- Does the team have at least one experienced Rust reviewer? Owner: Operator. Resolve by 2026-10-05.
- Spike (two days, in M0): the ACP client plus one PTY plus the worktree flow in both A and B, measuring code size, startup, and memory. Owner: engine lead. Resolve by 2026-10-07.

## Decision log
Pending.
