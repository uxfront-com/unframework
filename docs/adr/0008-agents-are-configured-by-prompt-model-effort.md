# ADR-0008: Agents are configured by a versioned prompt, a model, and an effort level
Date: 2026-09-30 · Status: Accepted
Deciders: Alex Grozav (Operator) · Informed by: deck slides 16–17
Supersedes: — · Superseded by: —

## Context
Teams need agents with distinct roles and behavior, and the ability to compare and reproduce results.

## Decision
We will configure each agent with a system prompt (immutable, numbered versions), a model, and an effort level (Low, Medium, High, Max). Adapters map these onto each harness. Runs record the exact agent, prompt version, model, effort, and harness version they used. Per-run overrides are saved on the issue, not on the agent.

## Consequences
- Good: reproducible runs; prompt changes can be compared across runs; effort maps to cost and depth predictably.
- Bad: effort semantics differ across harnesses, so “High” is not identical everywhere. Adapter manifests must document the mapping, and the UI must not promise equivalence.
- Neutral: prompt history and diffs are part of the Agents UI.

## Revisit triggers
- Harness-specific settings beyond model and effort become necessary for common use (for example, tool allowlists per agent).
