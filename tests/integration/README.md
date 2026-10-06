# The integration corpus

This is the verification machine of plan §7. Every case is one `.uf.tsx` input, compiled to all
seven targets, and every output is checked by the same expectations: one expectation, verified
seven times. A feature is done when its cases are green on every target, not when it emits code.

```sh
pnpm test                 # everything, from the repo root (turbo); or, in this package:
pnpm --filter @unframework/integration test -- --project "browser:vue"   # a subset
pnpm test:update          # rewrite the golden outputs and the shared expectations (never in CI)
pnpm test:baselines       # rewrite the Linux screenshot baselines, in Docker
pnpm test:baselines:check # compare the browser projects with them, as CI does, in Docker
pnpm test:canaries        # prove that every live layer catches the corruption it exists for
pnpm test:canaries L8     # the canaries of one layer, or name canaries by id
```

## A case

```
cases/basics/hello/
├── Hello.uf.tsx                       the one input
├── hello.test.ts                      the browser spec, written once and run on every target
├── case.json                          optional: { description, ssr: { <scenario>: { props } }, axe: [rule ids] }
├── __output__/
│   ├── ir.json                        the IR snapshot, validated against @unframework/ir's schema
│   └── <target>/<files>               the golden outputs: formatted, reviewed, checked in place
├── __expected__/                      shared by all seven targets
│   ├── diagnostics.json               the expected diagnostics ([] when there are none)
│   ├── ssr.default.html               the normalised server HTML of each SSR scenario
│   ├── dom.initial.html               the normalised client DOM of `expectParity("initial")`
│   ├── aria.initial.yaml              its accessibility tree
│   └── geometry.initial.json          its geometry and computed styles (Linux)
└── __screenshots__/initial-chromium-linux.png   its pixels (Linux)
```

A diagnostics case (`cases/diagnostics/*`) has no spec: its `__expected__/diagnostics.json` lists
the diagnostics, and `__output__/diagnostics.txt` is the code frame people and agents read.

The `.html` expectations use the canonical format of `@unframework/testing/normalize`: one node
per line, JSON-quoted text and attribute values, and form-control state as `uf:*`
pseudo-attributes. The normaliser removes framework noise, and only the target's own (ADR-0031):
every comment, which frameworks use as anchors; the attributes its framework adds, such as
`_ngcontent-*`, `q:*`, `data-hk` and `data-astro-cid-*`; and Angular's `uf-*` host elements with
`display: contents`. For every target, the reference included, it also writes one form of what
renders alike however it is written:

- attributes sorted by name, and a `class`'s tokens sorted, one space apart;
- a `style` in the CSSOM's format, its declarations sorted by property unless the order of two
  of them decides what renders (ADR-0044);
- no `class` without a token, no `style` without a declaration, and no declaration with an empty
  value (ADR-0044);
- a boolean attribute's value written empty (`disabled="disabled"` is `disabled=""`), and on
  Qwik, whose client writes a boolean that is on as `="true"`, that value too (ADR-0044);
- the compiler's generated ids renumbered `uf-id-1`, `uf-id-2`… wherever they are referenced;
- whitespace collapsed as Chromium renders it, and kept as written where the model cannot tell
  (around a table-internal box in an inline box, for one).

Nothing else is normalised. Markup the HTML parser would repair is an error, not a difference to
smooth over; adjacent text nodes read as one text, as HTML cannot tell them apart (L10's capture
merges them too, ADR-0044). The details are in `packages/testing/README.md` (Normalisation).

### Adding one

1. Create `cases/<area>/<name>/<Name>.uf.tsx` and, unless it is a diagnostics case,
   `<name>.test.ts`. The area, the name and every scenario (of `expectParity` and of
   `case.json`'s `ssr`) are kebab-case (`KEBAB_CASE` in `@unframework/testing/node`): words of
   `a-z` and `0-9` joined by single hyphens, such as `after-click`. A spec:

   ```ts
   import { describeTargets, mountScenario } from "@unframework/testing";
   import { expect, it } from "vitest";

   import Notice from "./Notice.uf.tsx";

   describeTargets("props/destructured-defaults", () => {
     it("renders every default when only the required prop is given", async () => {
       const view = await mountScenario(Notice, "defaults"); // case.json's ssr.defaults.props
       await view.expectParity("defaults");
       await expect.element(view.getByRole("heading", { name: "Notice" })).toBeVisible();
     });
   });
   ```

   Write each spec by these rules (ADR-0043); the canaries depend on them:
   - Each test calls `expectParity` first, then asserts at least one positive fact about what it
     rendered, through the view's queries (`getByRole`, `getByText`, …): text or a role that is
     there, not only one that is absent. A test without an assertion fails L8
     (`requireAssertions`). The L8 canary, which renders nothing, must fail L8 on every spec and
     target, but it judges the (case, target) cell, which fails when any of the case's tests
     does: a test that asserts only absences passes against the empty render unseen beside one
     that fails. This rule, not the canary, keeps such a test out.
   - A spec never branches on the target: one expectation, verified seven times.
   - Each test names its own scenario: unique in the case, with a string literal.
   - A scenario with a server twin mounts with `mountScenario(Component, name)`, which takes the
     props from `case.json`, so the server and the browser render the same props. A
     browser-only scenario (an explicit `undefined`, which JSON cannot carry, or a `rerender`)
     says so in a comment and mounts with `mount(Component, { props })`, typed by the
     component's props.
   - No hooks: each test mounts what it checks, and the setup's own `afterEach` records L8 and
     L13.

2. Run `pnpm test:update`. The compile project writes `__output__` and
   `__expected__/diagnostics.json`; the reference target (Vue, decision D10) writes the shared
   expectations, and every other target is compared with them in the same run.
3. Run `pnpm test:baselines` for the Linux screenshots and geometry (Docker).
4. Review every new file as carefully as code: the expectations are the contract.

## The layers

| Layer | Project               | What it checks                                                                                                                                   |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1    | `compile`             | The diagnostics equal `diagnostics.json`; every fix applies and recompiles clean.                                                                |
| L2    | `compile`             | The IR and the outputs equal `__output__`, byte for byte, with no stale files; compiling twice gives the same bytes; formatting is idempotent.   |
| L3    | `toolchain:<target>`  | Each output passes its framework's own compiler with zero warnings.                                                                              |
| L4    | `toolchain:<target>`  | Each output type-checks under one strictness for all seven checkers, one run per target over every case; a tsconfig problem fails every case.    |
| L5    | `toolchain:<target>`  | Each output passes oxlint's shared baseline rules and its framework's lint rules with zero warnings; rules that judge the author's code are off. |
| L6    | `ssr:<target>`        | The server render equals `ssr.<scenario>.html`.                                                                                                  |
| L7    | `browser:<target>`    | The client DOM and the ARIA tree equal `dom.<name>.html` and `aria.<name>.yaml`.                                                                 |
| L8    | `browser:<target>`    | The spec's own assertions pass: what it rendered, and what a rerender with new props changes.                                                    |
| L10   | `browser:<target>`    | Geometry and computed styles first, then pixels, with zero tolerance by default.                                                                 |
| L11   | `browser:<target>`    | axe-core reports no violations, or exactly the case's `axe` list.                                                                                |
| L13   | `ssr:` and `browser:` | No `console.warn` or `console.error` during render or mount.                                                                                     |

Each test records its layers in its task meta: `expectParity` records L7, L10 and L11 without
throwing, so the assertions after it always run, and the setup's `afterEach` records L8 from the
test's own errors, then fails the test with every failed layer. The parity reporter writes
`.reports/parity-matrix.<run>.json`; `pnpm --filter @unframework/integration summary` merges them
into `parity-matrix.json` and `parity-matrix.md` (CI's job summary). A cell is `pass`, `fail`,
`skip(reason)` or `quarantined(issue)`. A project that collects no tests fails, and when every
project ran, a missing cell fails. A project ran when an unfiltered run, or every shard of one
(`--shard 1/n` to `n/n`, of the same projects and nothing else filtered), ran it; a file or
test-name filter, or a missing shard, makes a partial run. In CI the summary is the parity job,
which requires every job's matrix; `pnpm test` summarises the projects it ran, so a run of some
of them (`--project`, `pnpm test:baselines:check`) is a partial run.

## The rules that keep it honest

- **Check mode never writes.** A missing artefact fails with the command that creates it. CI is
  always in check mode, and `pnpm test:update` refuses to run there.
- **One expectation, written once.** In update mode only the reference target writes the shared
  expectations; the others must match what it wrote in the same run (`sequence.groupOrder` runs it
  first).
- **The browser runs the reviewed code.** A guard fails any module whose compiled output differs
  from its committed golden file.
- **Pixels are Linux's.** The committed PNG and geometry come from `pnpm test:baselines`, in the
  same Playwright image the CI browser jobs use, on linux/amd64: the container exports
  `UF_BASELINE_ENVIRONMENT`, and no other environment may write them. The container sees the
  repository read-only. Once it stops, the script takes the baselines that changed out of it
  and copies only regular files at a baseline's path into the repository; anything else there
  refuses the copy. Elsewhere, every target is compared with the Vue capture from the same run (live mode),
  and nothing visual is written.
- **No stale expectations.** Every file under a case's `__expected__` and `__screenshots__`
  belongs to its diagnostics, an SSR scenario of its `case.json`, or an `expectParity` scenario
  of its spec (named with a string literal, so the harness can read it). The compile project
  fails on any other file, and `pnpm test:update` deletes it.
- **Canaries.** `pnpm test:canaries` corrupts the compile in a way one layer exists to catch,
  mostly with a compiler plugin (an unexpected diagnostic in every source, a throwing plugin, an
  IR change, an edited output file, output that differs between two compiles, unformatted
  output, a mismatched closing tag, a type error, a `debugger` statement, an idiom the
  framework's lint rules forbid, wrong text, a render of nothing, a hidden root, inverted
  colours, an invalid ARIA role, a console warning), with a fix that fixes nothing (corrupted by
  the harness, on the cases whose diagnostics have a fix), and with one that only the golden
  guard can catch, in the server render and in each browser spec's import. The run fails unless
  every canary is caught by its own layer on every case and target it corrupts, in each
  sub-check it names: the diagnostics (the diagnostics cases' too) and their fixes, the IR
  snapshot and the golden files, determinism and formatting, the baseline lint rules and the
  framework's, the DOM and the ARIA tree, the spec's assertions, geometry and pixels, the
  server's console and the page's. A canary changes only what every render shows and keeps the
  IR valid; the harness's unit tests run each one on every case of the corpus. CI runs the
  canaries as a matrix, a layer or a canary per job, with at most one canary that runs the
  browser projects in each.
- **The quarantine only shrinks.** `harness/quarantine.ts` lists known failures with a reason and
  an issue. A quarantined cell still runs and must still fail; once it passes, the entry is stale
  and fails the run until it is removed.
- **The coverage gate.** Every IR node and attribute kind, every capability a target supports and
  every catalogued diagnostic code needs a case. `harness/coverage-exemptions.ts` excuses the ones
  that have none yet, each with a reason; an exemption that the corpus covers fails the gate.

## Where things live

- `harness/projects.ts`: the Vitest projects (`compile`, `harness`, and `toolchain:`, `ssr:` and
  `browser:` per target). `UF_TARGETS=vue,react` restricts the targets.
- `harness/compile.test.ts`, `toolchain.test.ts`, `ssr.test.ts`: the node-side layers;
  `compile-checks.ts`: L1's fix check and L2's determinism and formatting checks;
  `toolchain-results.ts`: what L3, L4 and L5 make of each tool's report.
- `harness/canaries.ts`, `canary-verdict.ts`, `load-failures.ts`: the canaries, how
  `pnpm test:canaries` judges each run, and the specs a canary run could not load.
- `@unframework/testing`: `describeTargets`, `mount`, `expectParity`, the normaliser, the write
  policy, the visual capture and the parity reporter.
- `@unframework/target-<name>/toolchain`: each framework's Vite plugins, mount adapter (with its
  rerender), server renderer, compiler check (L3), type check (L4) and lint (L5).
- `../toolchains/<name>`: the checkers and tsconfigs that type-check each target's outputs,
  with TypeScript 6 where a checker still needs it, and the lint configurations:
  `output.oxlintrc.json` for every target (not `.oxlintrc.json`, which the repository's own
  lint would pick up), and `eslint.config.js` for the template languages (Vue, Svelte, Astro,
  Angular). The harness passes them explicitly, since the outputs it lints sit outside the
  toolchain directories (ADR-0042).
