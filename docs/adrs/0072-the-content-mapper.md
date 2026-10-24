# ADR-0072: The content mapper

- **Status:** Proposed
- **Date:** 2026-10-24
- **Plan:** §5.5, §5.6 (layers 1 to 3), §9 M5; P2; R3; ADR-0005, ADR-0023, ADR-0055, ADR-0067,
  ADR-0068, ADR-0071; amends ADR-0023

## Context

A component's props are in its signature, so stock tsgo checks them for every consumer. Its events,
models and slots are declared by macros in the body, which TypeScript can't see (§5.6). Layer 1
keeps stock tsgo free of false errors, and layer 2, the compiler, catches unknown events, models
and slots (UF3036 to UF3038, ADR-0055). Neither checks an event's payload, a model's type or a slot
prop. Layer 3 closes that gap: `@unframework/language-tools`, a TypeScript 7.1 content mapper for
`.uf.tsx` (§5.6).

ADR-0023's spike showed that a 7.1 content mapper can claim `.uf.tsx`, from the CLI and the API
project system, with the third-party SDK `ts-content-mapper@0.1.0`. It left one item open:
"Re-verify the protocol and the SDK on 7.1 stable before M5 commits to them." TypeScript 7.1 is
planned for 24 November 2026, a month after M5 starts, and M5 lands as one integration PR.

## Decision

**The package.** `@unframework/language-tools` is a content mapper for `.uf.tsx`. Its
`package.json` declares `typescript.contentMapper`, as ADR-0023 describes, and users register it
under `contentMappers` and run tsgo with `--runExternalCode`.

- It analyses components through the project graph (ADR-0071), up to their declarations, so an
  edit to an imported type reaches the virtual TSX of its dependents.
- It serves virtual TSX in which each component's signature gains an explicit `onX?` per emit, a
  `"v-model:name"?` per model and the slot types, and the component is branded `TypedComponent`
  (`unframework/src/jsx-runtime.ts`), which drops layer 1's open signatures. It also serves span
  maps and the compiler's diagnostics.
- The SDK, `ts-content-mapper@0.1.0`, is pinned exactly and imported by one module,
  `src/protocol.ts`, so swapping it for our own client is a one-file change.

**What it catches.** With the mapper, tsgo reports each of these at the consumer's `.uf.tsx` line:
a wrong event payload, an unknown event, a wrong model type, an unknown model, a misused slot prop
and an undeclared slot key, on generic components too (ADR-0068). Correct consumers check clean.
Without `--runExternalCode`, tsgo falls back to layer 1, and a test pins that fallback.

**Layers 1 and 2 beside it.** Stock tsgo stays free of false errors: probes cover generic
components, imported props types and components that call composables, and every probe in
`probes/allowed/` checks clean. The component-API blind spots in `probes/allowed/blind-spots.uf.tsx`
are compiled, and a test asserts that each reports the code its comment names: UF3036 for
`onChnage`, UF3038 for unexpected children, UF3037 for `v-model:opne` and UF3038 for the `footer`
slot key. An undeclared hyphenated attribute stays the compiler's alone, even under the mapper
(ADR-0023).

**The TypeScript it runs on.** Tests run an exactly pinned 7.1 nightly through a catalog alias,
`typescript-71: npm:typescript@7.1.0-dev.<date>`, a devDependency of `language-tools` only, with
the version in `minimumReleaseAgeExclude` while it is recent. Before building the package, L30
re-verifies ADR-0023's spike on the newest nightly. The repo itself stays on 7.0.2.

**What it amends.** This record overrides ADR-0023's open item on 7.1 stable: M5 commits to the
pinned nightly, and the port to 7.1 stable, a separate issue once 7.1 ships, re-verifies the
protocol and the SDK there. The owner may hold the port instead, which makes it M5's last layer.

## Consequences

**Positive:**

- Consumers get complete type checking in tsgo and editors: payloads, model types and slot props,
  at their `.uf.tsx` lines.
- M5 lands without waiting a month for 7.1 stable.
- Layer 1 keeps working with no mapper, and a missing `--runExternalCode` degrades to it, never to
  false errors.

**Negative:**

- The protocol is unstable until 7.1 ships, so the nightly pin and the SDK may need changes in the
  port.
- The SDK is third-party, at 0.1.0.
- The mapper needs `--runExternalCode` from the CLI, `runExternalCode: true` from the API, and
  trusted workspaces in VS Code (ADR-0023).
- Two TypeScript 7 versions sit in the lockfile until the port.

**Open:**

- The port to TypeScript 7.1 stable, with the contract suite (ADR-0067) and the mapper's probes
  re-run on it.
- The VS Code native-preview extension with `runExternalCode` is still untested (ADR-0023).

## Alternatives considered

- **Our own protocol client.** It costs about one more agent-day, and has to follow a protocol that
  is unstable until 7.1. The SDK's one-module boundary keeps this option open.
- **Wait for 7.1 stable before building the mapper.** A layer waiting on it would hold M5's one
  integration PR for a month.
- **A tsserver or Volar plugin.** TypeScript 7 replaces both with content mappers (§5.5).
