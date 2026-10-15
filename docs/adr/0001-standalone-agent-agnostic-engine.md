# ADR-0001: The engine is standalone and agent-agnostic
Date: 2026-09-30 · Status: Accepted
Deciders: Alex Grozav (Operator) · Informed by: UDAX design deck, implementation plan §1
Supersedes: — · Superseded by: —

## Context
UDAX orchestrates coding agents, and the harness landscape (Claude Code, Codex, Gemini CLI, OpenCode, in-house agents) changes monthly. Coupling the product to one harness would tie its roadmap to a vendor’s. The product also has to run in several shapes: a solo laptop, a team server, and headless automation.

## Decision
We will build the engine as a standalone service that knows no specific harness. Harnesses integrate only through adapters that implement an engine-defined contract.

## Consequences
- Good: any harness can be added without engine changes; teams can mix harnesses per agent; the engine runs headless, on a laptop or a server.
- Bad: the product exposes the common denominator of harness features unless adapters use extensions. Harness-specific capabilities (usage reporting, resume) arrive unevenly, and the UI has to say when data is unavailable.
- Neutral: an adapter conformance suite and capability matrix become permanent test assets.

## Revisit triggers
- A harness feature customers need can’t be expressed through the adapter contract after an extension attempt.
