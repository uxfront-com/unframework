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
per line, JSON-quoted text and attribute values, attributes sorted, and form-control state as
`uf:*` pseudo-attributes. Framework noise (comment anchors, `_ngcontent-*`, `q:*`, `data-hk`,
Angular host elements, whitespace that does not render) is normalised away; nothing else is.

### Adding one

1. Create `cases/<area>/<name>/<Name>.uf.tsx` and, unless it is a diagnostics case,
   `<name>.test.ts`. The area, the name and every scenario (of `expectParity` and of
   `case.json`'s `ssr`) are kebab-case (`KEBAB_CASE` in `@unframework/testing/node`): words of
   `a-z` and `0-9` joined by single hyphens, such as `after-click`. A spec:

   ```ts
   import { describeTargets, mount } from "@unframework/testing";
   import { expect, it } from "vitest";

   import Hello from "./Hello.uf.tsx";

   describeTargets("basics/hello", () => {
     it("renders the greeting", async () => {
       const view = await mount(Hello);
       await view.expectParity("initial"); // shared layers first, so they are always recorded
       await expect.element(view.getByText("Hello, world!")).toBeVisible();
     });
   });
   ```

2. Run `pnpm test:update`. The compile project writes `__output__` and
   `__expected__/diagnostics.json`; the reference target (Vue, decision D10) writes the shared
   expectations, and every other target is compared with them in the same run.
3. Run `pnpm test:baselines` for the Linux screenshots and geometry (Docker).
4. Review every new file as carefully as code: the expectations are the contract.

## The layers

| Layer | Project               | What it checks                                                                                                                                 |
| ----- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| L1    | `compile`             | The diagnostics equal `diagnostics.json`; every fix applies and recompiles clean.                                                              |
| L2    | `compile`             | The IR and the outputs equal `__output__`, byte for byte, with no stale files; compiling twice gives the same bytes; formatting is idempotent. |
| L3    | `toolchain:<target>`  | Each output passes its framework's own compiler with zero warnings.                                                                            |
| L4    | `toolchain:<target>`  | Each output type-checks under one strictness for all seven checkers, one run per target over every case; a tsconfig problem fails every case.  |
| L6    | `ssr:<target>`        | The server render equals `ssr.<scenario>.html`.                                                                                                |
| L7    | `browser:<target>`    | The client DOM and the ARIA tree equal `dom.<name>.html` and `aria.<name>.yaml`.                                                               |
| L10   | `browser:<target>`    | Geometry and computed styles first, then pixels, with zero tolerance by default.                                                               |
| L11   | `browser:<target>`    | axe-core reports no violations, or exactly the case's `axe` list.                                                                              |
| L13   | `ssr:` and `browser:` | No `console.warn` or `console.error` during render or mount.                                                                                   |

Each test records its layers in its task meta, and the parity reporter writes
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
  output, a mismatched closing tag, a type error, wrong text, a hidden root, inverted colours,
  an invalid ARIA role, a console warning), and with one that only the golden guard can catch,
  in the server render and in each browser spec's import. The run fails unless every canary is
  caught by its own layer on every case and target it corrupts, in each sub-check it names: the
  diagnostics (the diagnostics case's too), the IR snapshot and the golden files, determinism
  and formatting, the DOM and the ARIA tree, geometry and pixels, the server's console and the
  page's. L1's fix check has no canary until a case has a diagnostic with a fix (M1); its unit
  tests prove it on the real compiler.
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
  `compile-checks.ts`: L1's fix check and L2's determinism and formatting checks.
- `harness/canaries.ts`, `canary-verdict.ts`, `load-failures.ts`: the canaries, how
  `pnpm test:canaries` judges each run, and the specs a canary run could not load.
- `@unframework/testing`: `describeTargets`, `mount`, `expectParity`, the normaliser, the write
  policy, the visual capture and the parity reporter.
- `@unframework/target-<name>/toolchain`: each framework's Vite plugins, mount adapter, server
  renderer, compiler check (L3) and type check (L4).
- `../toolchains/<name>`: the checkers and tsconfigs that type-check each target's outputs,
  with TypeScript 6 where a checker still needs it.
