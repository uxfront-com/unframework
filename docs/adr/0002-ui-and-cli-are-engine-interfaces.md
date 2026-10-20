# ADR-0002: The UI and the CLI are interfaces to the engine
Date: 2026-09-30 · Status: Accepted
Deciders: Alex Grozav (Operator) · Informed by: implementation plan §5
Supersedes: — · Superseded by: —

## Context
People use UDAX through a canvas UI and a terminal. Agents use it through the CLI and MCP. If rules lived in several places (statuses, ownership, autonomy, budgets), the interfaces would drift and agents could bypass checks.

## Decision
We will keep all business rules in the engine. The UI, the CLI, and the MCP server are clients of the engine’s public, versioned API and contain no domain logic beyond presentation and input validation.

## Consequences
- Good: one source of truth for policy; every capability is automatable; new interfaces are cheap; agents and people are held to the same rules.
- Bad: every feature needs an API before it has a UI, so latency-sensitive UI features depend on the sync protocol’s quality. The API surface is a long-term compatibility commitment.
- Neutral: OpenAPI, generated clients, and breaking-change checks are mandatory infrastructure.

## Revisit triggers
- An interface needs capabilities that would force private, non-public endpoints.
