# Architecture Decision Records

This directory records the architectural decisions behind the Unframework compiler, one decision
per file. Each record states the context, the decision, its consequences and the alternatives that
lost, so that a later reader can see why the compiler is shaped the way it is.

The first records are seeded from §11 of the compiler plan, [`docs/plan.md`](../plan.md)
(proposal, 2026-10-01):

- `§` references point at sections of that plan.
- `R1`–`R14` are its risks (§10), `P1`–`P8` its principles and `G1`–`G7` its goals (§3).
- `L1`–`L15` are the verification layers (§7.2), and `M0`–`M10` the milestones (§9).
- Three-digit references such as v1's ADR-003 or ADR-008 are the Inkline compiler's records, kept
  for reference in `packages/compiler-v1`. Records here use four digits.

## Format

Every record follows [`template.md`](./template.md):

- `# ADR-NNNN: <Title>`
- a metadata block: **Status**, **Date** and **Plan** (the plan sections it draws on)
- `## Context`: the forces behind the decision
- `## Decision`: what we do, with a short example where it helps
- `## Consequences`: positive and negative, and anything still open
- `## Alternatives considered`: what lost, and why

A record stays between about 40 and 120 lines. It cites the plan rather than restating it.

## Statuses

| Status                                             | Meaning                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Accepted                                           | Confirmed. The plan's C1–C4.                                                                                       |
| Proposed — the plan proceeds on the recommendation | Recommended and not yet confirmed. Work proceeds as if it were accepted unless told otherwise. The plan's D1–D13.  |
| Accepted (M0 spike)                                | Settled by one of M0's timeboxed spikes (§9).                                                                      |
| Superseded by ADR-NNNN                             | Replaced by a later record. The old record stays, unchanged apart from its status.                                 |
| …, amended by ADR-NNNN                             | A later record replaces some of its points and names them. The rest stands; the old record is otherwise unchanged. |

- When a proposed record is confirmed, set its status to Accepted and its date to the day of
  confirmation. If confirmation changes the decision, edit the record first.
- An accepted record is never rewritten. A new record supersedes it, and the two link to each other.

## Adding a record

1. Take the next free number. Numbers are never reused.
2. Copy [`template.md`](./template.md) to `NNNN-short-kebab-slug.md`.
3. Fill in every section. Cite the plan sections, risks and corpus cases it rests on.
4. Add a row to the index below.
5. If it replaces a record, set the old record's status to `Superseded by ADR-NNNN`.
6. Run `pnpm exec oxfmt docs/adrs` from the repo root.

## Index

| ADR                                                                | Title                                                                           | Status                                                                          | Plan                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------- |
| [0001](./0001-component-shape.md)                                  | Components are setup-once functions in JSX                                      | Accepted                                                                        | §11 C1                  |
| [0002](./0002-control-flow-is-plain-js.md)                         | Control flow is plain JS, and `v-model` is the only directive                   | Accepted, amended by ADR-0036                                                   | §11 C2                  |
| [0003](./0003-public-api-vue-macros.md)                            | The public API is declared with Vue macros                                      | Accepted                                                                        | §11 C3                  |
| [0004](./0004-sibling-css-scoped-by-the-compiler.md)               | Styles are a sibling CSS file, scoped by the compiler                           | Accepted, amended by ADR-0063, ADR-0064                                         | §11 C4                  |
| [0005](./0005-source-extension.md)                                 | Components are `.uf.tsx`, composables are `.uf.ts`                              | Proposed                                                                        | §11 D1                  |
| [0006](./0006-authoring-import-and-jsx-runtime.md)                 | The authoring API and JSX runtime come from `unframework`                       | Proposed, amended by ADR-0090                                                   | §11 D2                  |
| [0007](./0007-canonical-forms.md)                                  | One canonical form per concept                                                  | Proposed                                                                        | §11 D3                  |
| [0008](./0008-state-updates.md)                                    | State is replaced whole, never mutated in place                                 | Proposed                                                                        | §11 D4                  |
| [0009](./0009-css-scoping-algorithm.md)                            | CSS is scoped with Vue's attribute algorithm                                    | Accepted, amended by ADR-0063                                                   | §11 D5                  |
| [0010](./0010-angular-host-element.md)                             | Angular hosts are elements with `display: contents`                             | Accepted, amended by ADR-0056, ADR-0060                                         | §11 D6, §9 M1           |
| [0011](./0011-target-versions.md)                                  | Target framework versions                                                       | Proposed, amended by ADR-0094                                                   | §11 D7                  |
| [0012](./0012-output-event-and-model-names.md)                     | Events and models take each target's naming convention                          | Proposed, amended by ADR-0056                                                   | §11 D8                  |
| [0013](./0013-visual-baselines.md)                                 | Visual baselines live in Linux CI, plus a live mode                             | Accepted                                                                        | §11 D9                  |
| [0014](./0014-reference-target.md)                                 | Vue is the reference target for expectations                                    | Proposed, amended by ADR-0057                                                   | §11 D10                 |
| [0015](./0015-no-runtime.md)                                       | No runtime, only inline helpers                                                 | Proposed, amended by ADR-0064                                                   | §11 D11                 |
| [0016](./0016-package-naming.md)                                   | `unframework` plus `@unframework/*`                                             | Superseded by ADR-0090                                                          | §11 D12                 |
| [0017](./0017-jsx-attribute-and-event-names.md)                    | HTML attribute names and Vue event names in JSX                                 | Proposed                                                                        | §11 D13                 |
| [0018](./0018-one-vitest-run-browser-projects.md)                  | One Vitest 5 run with one browser project per target                            | Accepted (M0 spike), amended by ADR-0081                                        | §9 M0 spike 1           |
| [0019](./0019-shared-screenshot-baselines.md)                      | Screenshot baselines are shared through a custom browser command                | Accepted (M0 spike), amended by ADR-0029, ADR-0050, ADR-0061, ADR-0066          | §9 M0 spike 2           |
| [0020](./0020-astro-container-api-and-static-mount.md)             | Astro renders through the Container API, in Node and for the browser            | Accepted (M0 spike)                                                             | §9 M0 spike 3           |
| [0021](./0021-virtual-ids-through-framework-plugins.md)            | Virtual ids reach each framework's own Vite plugin                              | Accepted (M0 spike), amended by ADR-0027, ADR-0053, ADR-0063                    | §9 M0 spike 4           |
| [0022](./0022-typescript-6-checkers-beside-typescript-7.md)        | TypeScript 6 checkers live beside TypeScript 7                                  | Accepted (M0 spike), amended by ADR-0028                                        | §9 M0 spike 5           |
| [0023](./0023-uf-tsx-under-tsgo.md)                                | `.uf.tsx` type-checks under tsgo, and a content mapper can claim it             | Accepted (M0 spike)                                                             | §9 M0 spike 6           |
| [0024](./0024-ssr-renderers.md)                                    | SSR renderers for L6 in `ssr:<target>` projects                                 | Accepted (M0 spike), amended by ADR-0027, ADR-0031, ADR-0093, ADR-0095          | §9 M0, extra spike      |
| [0025](./0025-framework-compile-in-process.md)                     | L3 runs each framework's own compiler in-process                                | Accepted (M0 spike), amended by ADR-0028, ADR-0063                              | §9 M0, extra spike      |
| [0026](./0026-markup-is-never-formatted.md)                        | Markup is never formatted; oxfmt formats code only                              | Accepted, amended by ADR-0041                                                   | §5.8, R14               |
| [0027](./0027-angular-compiles-virtual-modules-with-ngtsc.md)      | Angular compiles virtual modules with our ngtsc step                            | Accepted, amended by ADR-0053, ADR-0093                                         | §8.2, R5                |
| [0028](./0028-checker-details-after-m0.md)                         | How the L3 and L4 checkers changed during M0                                    | Accepted                                                                        | §7.2, §7.7              |
| [0029](./0029-artefact-write-policy-as-built.md)                   | The artefact write policy and visual parity, as built                           | Accepted, amended by ADR-0062, ADR-0066                                         | §7.4, §7.6, D9          |
| [0030](./0030-jsx-text-and-bare-attributes.md)                     | JSX text where every JSX agrees; bare attributes mean "true"                    | Accepted                                                                        | §4.3, §4.6              |
| [0031](./0031-normalisation-removes-only-the-targets-own-noise.md) | Normalisation removes only the target's own noise                               | Accepted, amended by ADR-0044, ADR-0049, ADR-0058, ADR-0061, ADR-0081, ADR-0095 | §7.5                    |
| [0032](./0032-ir-semantic-invariants.md)                           | The IR has semantic invariants, checked after every plugin                      | Accepted, amended by ADR-0034 to ADR-0040, ADR-0045, ADR-0055                   | §5.3, §5.10             |
| [0033](./0033-framework-rendering-differences-are-capabilities.md) | What a framework renders differently is a declared capability                   | Accepted, amended by ADR-0047                                                   | P4, §5.7, D10           |
| [0034](./0034-props-in-the-signature.md)                           | Props are a typed signature parameter with static defaults                      | Accepted, amended by ADR-0045, ADR-0049, ADR-0054, ADR-0067, ADR-0068, ADR-0094 | §4.2, §6, §9 M1         |
| [0035](./0035-render-expressions.md)                               | Render expressions are a scope-analysed subset                                  | Accepted, amended by ADR-0045                                                   | §4.5, §5.4              |
| [0036](./0036-control-flow-children-and-lists.md)                  | Conditionals test truthiness, and lists need one keyed element                  | Accepted, amended by ADR-0046, ADR-0054                                         | §4.3, §5.4              |
| [0037](./0037-bound-attributes-and-rendered-values.md)             | A bound value must render the same on every target                              | Accepted                                                                        | §4.3, §6, P4            |
| [0038](./0038-class-and-style-bindings.md)                         | `class` binds a set of tokens; `style` binds declarations                       | Accepted, amended by ADR-0065                                                   | §4.3, §6, M4            |
| [0039](./0039-spreads-with-known-keys.md)                          | An attribute spread renders exactly its declared keys                           | Accepted, amended by ADR-0045, ADR-0054, ADR-0065                               | §4.3, §6                |
| [0040](./0040-svg.md)                                              | SVG is lowered inside `<svg>`, with case-exact tables                           | Accepted                                                                        | §4.3, §9 M1             |
| [0041](./0041-script-blocks-and-frontmatter-are-formatted.md)      | Script blocks and frontmatter are formatted as TypeScript                       | Accepted, amended by ADR-0051                                                   | §5.8, R14               |
| [0042](./0042-l5-lints-the-emitters-idiom.md)                      | L5 lints the emitter's idiom                                                    | Accepted, amended by ADR-0045, ADR-0047, ADR-0048, ADR-0054, ADR-0056           | §7.2 L5                 |
| [0043](./0043-l8-behaviour-soft-parity-and-rerender.md)            | L8 records the spec's assertions, and parity is soft                            | Accepted, amended by ADR-0050, ADR-0052, ADR-0073, ADR-0094                     | §7.2 L8, §7.7           |
| [0044](./0044-empty-class-and-style-and-declaration-order.md)      | An empty `class` or `style` is no attribute                                     | Accepted, amended by ADR-0094                                                   | §7.5                    |
| [0045](./0045-setup-code-is-a-scope-analysed-subset.md)            | Setup code is a scope-analysed subset, in source order                          | Accepted, amended by ADR-0054, ADR-0069, ADR-0070                               | §4.2, §5.3, §5.4, §9 M2 |
| [0046](./0046-state-and-derived-values-on-every-target.md)         | State and derived values keep one contract on every target                      | Accepted                                                                        | §4.5, §6, §9 M2         |
| [0047](./0047-events-listeners-handlers-and-emits.md)              | Listeners keep the DOM's semantics, and events are named tuples                 | Accepted, amended by ADR-0054, ADR-0056, ADR-0063, ADR-0094                     | §4.2, §4.3, §6, §9 M2   |
| [0048](./0048-effects-and-lifecycle.md)                            | Effects and lifecycle hooks run in the browser, with Vue's timing               | Accepted                                                                        | §4.2, §4.5, §6, §9 M2   |
| [0049](./0049-template-refs-and-ids.md)                            | A template ref holds one element, and every id starts `uf-id-`                  | Accepted, amended by ADR-0095                                                   | §4.2, §6, §7.5, §9 M2   |
| [0050](./0050-l8-interactions-and-l9-traces.md)                    | L8 runs a person's input, and L9 compares every step                            | Accepted, amended by ADR-0057, ADR-0068                                         | §7.2 L8, L9, §9 M2      |
| [0051](./0051-copied-setup-code-never-ends-its-block.md)           | Copied setup code never ends a script block or a frontmatter                    | Accepted                                                                        | §5.8, R14               |
| [0052](./0052-browser-canaries-run-in-shards.md)                   | A canary whose browser specs run is sharded by case in CI                       | Accepted, amended by ADR-0073                                                   | §7.7, §7.9              |
| [0053](./0053-child-components-across-files.md)                    | A child's API reaches `compile()` through a resolver                            | Accepted, amended by ADR-0063, ADR-0067, ADR-0071                               | §4.3, §5.10, §9 M3      |
| [0054](./0054-composition-on-every-target.md)                      | Composition constructs on every target                                          | Accepted                                                                        | §4.2, §4.3, §6, §9 M3   |
| [0055](./0055-composition-ir-capabilities-and-codes.md)            | The composition contract: IR kinds, capabilities and codes                      | Accepted                                                                        | §5.3, §5.6, §5.9, §9 M3 |
| [0056](./0056-angular-hosts-in-composition.md)                     | Angular composition: roots, fallthrough, slots, event names                     | Accepted                                                                        | §6, §7.5, §9 M3         |
| [0057](./0057-multi-source-cases-and-composed-mounts.md)           | Cases hold several sources and compose through harness parents                  | Accepted                                                                        | §7.1, §7.3, §9 M3       |
| [0058](./0058-normalising-slot-templates-and-bound-values.md)      | Normalising Qwik's slot templates and bound `value` attributes                  | Accepted                                                                        | §4.5, §7.5, §9 M3       |
| [0059](./0059-l4-consumer-type-tests.md)                           | L4 consumer type tests: misuse fixtures with inline expectations                | Accepted, amended by ADR-0068                                                   | §5.6, §7.2, §9 M3       |
| [0060](./0060-react-bound-controls-and-angular-host-spaces.md)     | React's bound controls and Angular's host spaces                                | Proposed, amended by ADR-0095                                                   | §6, §7.5, §9 M3         |
| [0061](./0061-visual-context-and-geometry.md)                      | Visual context and geometry for styled components                               | Accepted, amended by ADR-0081                                                   | §7.5, §7.6, §9 M4       |
| [0062](./0062-baselines-generated-in-ci.md)                        | CI generates the Linux baselines, and a script applies them                     | Accepted                                                                        | §7.4, §7.9, §9 M4       |
| [0063](./0063-scoped-stylesheets.md)                               | Scoped stylesheets, from the import to each target's attachment                 | Accepted                                                                        | §4.4, §6, §9 M4         |
| [0064](./0064-styling-engines-and-ci-without-a-licence.md)         | Styling engines through virtual modules, and CI without a licence               | Accepted                                                                        | §4.4, R11, §9 M4        |
| [0065](./0065-the-deferred-binding-forms.md)                       | The binding forms ADR-0038 and ADR-0039 deferred to M4                          | Accepted                                                                        | §4.3, §6, §9 M4         |
| [0066](./0066-firefox-and-webkit-nightly.md)                       | Firefox and WebKit run nightly, live against the reference in the same engine   | Accepted, amended by ADR-0081                                                   | §7.2, §7.6, §9 M4       |
| [0067](./0067-the-type-oracle-and-cross-file-props-types.md)       | The type oracle and cross-file props types                                      | Accepted, amended by ADR-0082                                                   | §5.5, §5.6, §9 M5       |
| [0068](./0068-generic-components-and-exported-public-types.md)     | Generic components and exported public types                                    | Accepted                                                                        | §4.2, §5.6, §9 M5       |
| [0069](./0069-composables-compiled-per-target.md)                  | Composables compiled per target                                                 | Accepted                                                                        | §4.1, §6, §9 M5, D1     |
| [0070](./0070-shared-modules-and-module-level-declarations.md)     | Shared modules and module-level declarations                                    | Accepted                                                                        | §4.1, §9 M5             |
| [0071](./0071-the-project-graph-and-incremental-invalidation.md)   | The project graph and incremental invalidation                                  | Accepted                                                                        | §5.10, §8.2, §9 M5      |
| [0072](./0072-the-content-mapper.md)                               | The content mapper                                                              | Proposed                                                                        | §5.6, §9 M5             |
| [0073](./0073-canaries-run-on-harness-changes-and-nightly.md)      | Canaries run on harness changes and nightly                                     | Accepted, amended by ADR-0084                                                   | §7.7, §7.9              |
| [0074](./0074-source-maps-anchored-after-emit.md)                  | Source maps are anchored after emit and remapped through formatting             | Accepted                                                                        | §5.8, §7.2, §9 M6       |
| [0075](./0075-a-portable-bundler-plugin.md)                        | A portable bundler plugin, tested on Vite                                       | Accepted                                                                        | §8.2, §9 M6             |
| [0076](./0076-configuration-and-the-cli.md)                        | Configuration and the CLI                                                       | Accepted, amended by ADR-0090, ADR-0086                                         | §8.1, §8.3, §9 M6       |
| [0077](./0077-per-target-packaging.md)                             | Per-target packaging                                                            | Accepted, amended by ADR-0082                                                   | §8.4, §9 M6             |
| [0078](./0078-the-source-map-and-budget-layers.md)                 | L14 checks source maps and L15 checks budgets                                   | Accepted                                                                        | §7.2, §9 M6             |
| [0079](./0079-the-e2e-apps-and-packed-tarballs.md)                 | The e2e apps install packed tarballs outside the workspace                      | Accepted, amended by ADR-0082, ADR-0090, ADR-0089                               | §9 M6                   |
| [0080](./0080-jsx-import-source-in-host-apps.md)                   | `jsxImportSource` in host apps is a scoped `tsconfig.uf.json`                   | Accepted, amended by ADR-0090                                                   | §8.2, §9 M6             |
| [0081](./0081-nightly-engines-one-project-one-file-at-a-time.md)   | The nightly engines run one project and one file at a time                      | Accepted                                                                        | §7.3, §7.6, §9 M4       |
| [0082](./0082-vue-without-typescript-sys.md)                       | Vue builds on TypeScript 7 without `script.fs`                                  | Accepted                                                                        | §8.2, §8.4, §9 M6       |
| [0083](./0083-browser-layers-stay-on-vitest.md)                    | The browser layers stay on Vitest                                               | Accepted                                                                        | §7.2, §7.3              |
| [0084](./0084-docs-only-pull-requests-skip-the-tests.md)           | Docs-only pull requests skip the tests, and pushes run no canary                | Accepted                                                                        | §7.7, §7.9              |
| [0085](./0085-the-public-api-of-unframework-testing.md)            | The public API of `@unframework.dev/testing` is its root entry and the case     | Accepted                                                                        | §7.3, §8.5, §9 M7       |
| [0086](./0086-a-projects-tests-with-define-test-config.md)         | A project's tests run through `defineTestConfig` and `unframework test`         | Accepted                                                                        | §7.3, §8.5, §9 M7       |
| [0087](./0087-examples-and-unframework-visual.md)                  | Examples run on every target through `@unframework.dev/visual`                  | Accepted                                                                        | §8.6, §9 M7             |
| [0088](./0088-unframework-preview.md)                              | `unframework preview` shows every example on every target, one Vite server each | Accepted                                                                        | §8.6, §9 M7             |
| [0089](./0089-the-design-system-runs-from-tarballs.md)             | The sample design system's tests run from tarballs, outside the workspace       | Accepted                                                                        | §7.9, §8.5, §9 M7       |
| [0090](./0090-npm-package-names.md)                                | `@uxfront/unframework` plus `@unframework.dev/*`                                | Accepted                                                                        | §11 D2, D12             |
| [0091](./0091-a-dropped-reference-fails-the-run-once.md)           | A reference that did not finish a case fails the run once                       | Accepted                                                                        | §7.2, §7.4, §7.7        |
| [0092](./0092-browser-spec-files-share-a-page.md)                  | Browser spec files share a page, but on Vue                                     | Accepted                                                                        | §7.3, §7.6              |
| [0093](./0093-slow-harness-files-run-as-shards.md)                 | The slow harness files run as shards, and Angular's ngtsc compiles in a pool    | Accepted                                                                        | §7.3, §7.7, R5          |
| [0094](./0094-qwik-moves-to-its-2-0-release-candidate.md)          | Qwik moves to its 2.0 release candidate                                         | Accepted                                                                        | §11 D7, §9 M8, R6       |
| [0095](./0095-hydration.md)                                        | L12 hydrates every case's server render                                         | Accepted                                                                        | §7.2 L12, §9 M8, R5     |

"Proposed" in the index is short for "Proposed — the plan proceeds on the recommendation".

**0018 onwards** are the M0 spike records (§9). 0018–0023 record M0's six numbered spikes in order:
browser projects, screenshot baselines, Astro, virtual ids, TypeScript 6 beside 7, and `.uf.tsx`
under tsgo. 0024 (SSR renderers for L6) and 0025 (framework compile for L3) record two extra spikes
that de-risked layers M0 makes live. Spike records differ from the format above in two ways:

- They add an `## Evidence` section after the alternatives, with the decisive commands, messages and
  numbers. "The spike's scratch project" is the throwaway project each spike ran in, not part of the
  repo.
- They run longer than 120 lines, because the exact options, ids, versions and failure messages are
  what an implementer needs.

Where a spike confirms or refines one of 0001–0017, the older record's Consequences point to it with
a "See also" line.

**0034 onwards** record the decisions of M1, props and static JSX (§9). Where probes against the
installed frameworks back a decision, the record adds an `## Evidence` section and may run longer
than 120 lines, as the spike records do. They record what M1 built: the Evidence section names
the tests that pin a claim, by their files in this repository, and states as a probe's finding
what no test pins. The user-facing account of the same rules is in
[`apps/web/content/docs`](../../apps/web/content/docs) (Components and Reference).

**0045 onwards** record the decisions of M2, reactivity, events and behaviour (§9), in M1's format.
Each records what M2 built. Where it differs from plan §6's starting mapping, because a probe or a
framework's tools ruled that shape out, the record says what was built and why. Three adversarial
reviews followed M2's first build, and the records were amended in place, before M2 closed, to
state what the fixes built: each record's alternatives name the first build's shape where a fix
replaced it.

**0053 onwards** record M3's design, composition (§9), proposed before it was built. Spikes in a
scratch project back each record: hand-written outputs for all seven targets, run through every
framework's Vite plugin, checker and linter and the SSR and browser projects. The `## Evidence`
sections give the commands, messages and versions, as the M0 spike records do. M3 accepted them
as built: each was amended in place where the build differed, and its alternatives name the
proposed shape the build replaced, with the reason. The records they amend carry their new
status.
