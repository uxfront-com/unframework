# RFC-0003: How should state be stored and synced to clients?
Status: In review
Author: Claude (for Alex Grozav) · Reviewers: Alex Grozav · Class: 3 · Comment window closes: 2026-10-05

## Problem
The product is history-heavy. Activity, Replay, requests, decisions, provenance (“what was the agent told?”), and audit are all views of what happened. Clients must feel instant (Linear-grade): optimistic writes, live updates, warm starts from local cache, offline tolerance. The engine runs standalone on a laptop (no external database) and as a team server (many users, many runners). Permissions must filter what each client receives.

## Options considered

### Option A: Event-sourced engine plus a custom snapshot-and-delta sync
An append-only event log (SQLite WAL locally, Postgres for teams) with projections updated in the same transaction. Reactors automate. Clients bootstrap a snapshot, then receive ordered deltas over WebSocket with a cursor, and send commands with optimistic application and reconciliation. This is the shape of Linear’s own sync engine.
- **For**: the product’s history features fall out of the model for free. Deterministic replay makes tests and debugging strong. There is one store for local and team modes. The server filters deltas by permission. No third-party sync service to run.
- **Costs**: we build and own the sync protocol (ordering, reconnect, partial loading, reconciliation) and event versioning (upcasters).
- **Risks**: sync bugs are subtle. Mitigations: a narrow protocol (a cursor plus deltas), property tests on reorder and reconnect, and a single write path.

### Option B: Postgres-centric state with an off-the-shelf sync engine (ElectricSQL or Zero)
The current state lives in normal tables, and a sync engine replicates filtered subsets (“shapes” or queries) to clients.
- **For**: less custom sync code; proven partial replication; excellent live queries on the client.
- **Costs**: local standalone mode would need Postgres plus the sync service on every laptop, which is heavy for a single-binary engine. History still needs an event or audit log, so there are two models to maintain. Permission filtering must be expressed in the sync engine’s terms.
- **Risks**: operational weight in solo mode; coupling to a vendor’s roadmap.

### Option C: CRDT documents (Automerge, Yjs, Loro)
The graph lives in replicated documents that merge automatically.
- **For**: true offline multi-writer editing and peer-to-peer potential.
- **Costs**: the product is server-authoritative. State machines, policies, and agent actions must be validated centrally, which CRDTs do not model well. Document growth and history compaction need care.
- **Risks**: fighting the model for every policy rule.

### Option D (status quo for many apps): REST plus polling or cache invalidation
- **For**: simplest to start.
- **Costs**: no instant multi-user updates, weak offline behavior, and no natural history. It fails the Linear-grade bar and the replay feature.

## Trade-off summary
| | A: Events + custom sync | B: Postgres + sync engine | C: CRDT | D: REST |
|---|---|---|---|---|
| Fit to history features | **Best** | Fair (second log needed) | Fair | Poor |
| Solo, standalone mode | **Best** | Poor | Good | Good |
| Build effort | High | **Medium** | High | **Low** |
| Client speed and liveness | Very good | **Best** | Very good | Poor |
| Policy enforcement | **Best** | Good | Poor | Good |
| Reversibility | Low | Low | Low | Medium |

## Recommendation
**Option A.** It matches both the product (history everywhere) and the deployment constraint (one binary, no external services in solo mode). On the client, M4 runs a one-week spike: TanStack DB (a reactive client store with live queries and optimistic transactions, pre-1.0 as of this RFC) fed by a custom UDAX collection, against a MobX object pool of the kind Linear uses. The winner is recorded in an ADR.

**The strongest argument against**: we are building a sync engine, which specialist companies spend years on. If the team finds reconciliation or partial sync consuming a milestone, Option B is the retreat for team mode. Revisit triggers:
- more than 2 weeks of M4 spent on sync bugs, or
- delta fanout p95 over 500 ms at 50 concurrent clients in team mode (switch fanout to NATS JetStream first), or
- a requirement for true offline multi-writer editing.

## Open questions
- The event retention and compaction policy for RunSteps in team mode. Owner: engine lead. Resolve by M13.
- Postgres row-level security as defense in depth versus the typed repository layer only. Owner: engine lead. Resolve by M13.

## Decision log
Pending.
