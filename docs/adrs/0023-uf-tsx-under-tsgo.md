# ADR-0023: `.uf.tsx` type-checks under tsgo, and a content mapper can claim it

- **Status:** Accepted (M0 spike)
- **Date:** 2026-10-01
- **Plan:** §9 (M0 spike 6); §11 D1, D2 and D13; §4.1–§4.3, §4.6, §5.5, §5.6, R2, R3

## Context

A `.uf.tsx` component is ordinary TSX, type-checked by tsgo (`typescript@7.0.2`) with
`"jsx": "preserve"` and `"jsxImportSource": "unframework"` (ADR-0006). Spike 6 had to show that:

1. `unframework` can ship the authoring API as types plus inert stubs, shaped like Vue 3.5.
2. `unframework/jsx-runtime` can take its intrinsic elements from `@vue/runtime-dom@3.5.43` behind
   one owned alias, with a re-vendoring script (ADR-0017).
3. Layer 1 of §5.6 works: stock tsgo raises no false errors on consumers, and probe tests pin what
   is and is not caught (R2).
4. §4.1's Counter and a consumer of it type-check clean.
5. A TS 7.1 content mapper can, or cannot, claim `.uf.tsx`, a suffix of the native `.tsx` (R3).
   ADR-0005 left this open, with `.uf` as the fallback.

The spike's scratch project used pnpm 11.2.2 and Node 24.21.0, with typescript 7.0.2 and the 7.1
nightly 7.1.0-dev.20260930.4.

## Decision

**D1 stands: components stay `.uf.tsx`.** A TS 7.1 content mapper can claim `.uf.tsx`, and that
closes ADR-0005's open question in its favour:

- tsgo's config parser rejects only an extension equal to a native one (`strings.EqualFold`), so
  `.uf.tsx` is accepted. `GetContentMapperForFileName` picks the longest registered suffix, and
  `fileloader.parseSourceFile` routes any path ending in a registered extension to the mapper before
  native parsing.
- A mapper registered for `.uf.tsx` ran from the CLI and from the API project system (the
  language-server path), with diagnostics mapped back to `.uf.tsx` positions.
- The `.uf` fallback also works with a mapper, but stock tsgo then cannot resolve `.uf` imports
  (`TS2307`), so layer 1 would need the mapper and editors a language association. `.uf.tsx`
  needs neither.

`@unframework/language-tools` (M5) is a mapper package: its `package.json` has
`typescript.contentMapper: { exec: ["node", "<entry>"] }`, and users add
`"contentMappers": [{ "package": "@unframework/language-tools", "extensions": [".uf.tsx"] }]` and
run tsgo with `--runExternalCode`. Its virtual TSX (virtual extension `.tsx`) adds an explicit
`onX?` per emit, `"v-model:name"?` per model and the slot types, and brands the component
`TypedComponent`.

**The `unframework` package:**

- **`src/index.ts`, the authoring API:** `ref`, `computed`, `watch`, `watchEffect`, `onMounted`,
  `onUnmounted`, `nextTick`, the `define*` macros, `useTemplateRef`, `useId`, `provide` and
  `inject`, with types such as `Ref`, `ComputedRef`, `ModelRef`, `TemplateRef`, `InjectionKey` and
  `JSX`. Every stub throws ``unframework: `ref` is compile-time only…``. It compiles under
  `isolatedDeclarations` and `erasableSyntaxOnly` and runs under Node 24's type stripping.
  Signatures follow Vue 3.5 with deliberate restrictions:
  - `defineEmits<E extends Record<string, readonly unknown[]> = never>()` returns
    `<K extends keyof E & string>(event: K, ...payload: E[K]) => void`.
  - `defineModel<T>(name: string, options?)` has no zero-argument overload. With `{ default }` or
    `{ required: true }` it returns `ModelRef<T>`, otherwise `ModelRef<T | undefined>`.
  - `defineSlots<S = never>()` returns `Readonly<S>`. `computed` takes a getter only.
    `useTemplateRef<T = unknown>()` takes no key. `provide` and `inject` take `InjectionKey<T>`
    only, which carries a phantom member so that keys of different types stay distinct.
  - Macro type parameters default to `never`, so an un-parameterised macro cannot be used.
- **`src/vendor/vue-jsx.d.ts`** is vendored verbatim from `@vue/runtime-dom@3.5.43`
  `dist/runtime-dom.d.ts`, lines 96–1311 (the rolled-up `jsx.ts`, from `CSSProperties` to
  `NativeElements`). A generated header records the package, version, line range, the sha256 of
  the upstream file and of the body, and the MIT notice. A two-line prelude adds
  `import type * as CSS from "csstype"` and `type VNodeRef = unknown`. `scripts/vendor-jsx.ts`
  writes it, `--check` fails on drift, and the script refuses to run unless the devDependency is
  pinned exactly.
- **`src/jsx-upstream.ts`** is the only module that imports `./vendor/*`. It re-exports
  `UpstreamIntrinsicElements`, `UpstreamHTMLAttributes`, `UpstreamEvents`, `ClassValue`,
  `StyleValue` and `CSSProperties`. Swapping the upstream is a one-file change.
- **`src/jsx-runtime.ts`** holds the `JSX` namespace, which is exported, never global, so it cannot
  collide with a host app's:
  - `Element` is an opaque interface branded with a `unique symbol`. Components return it or `null`.
  - Each intrinsic element is `Omit<Upstream[K], "key" | "ref" | "children">` plus `key`, a
    contravariant `ref?: RefAttribute<…>`, `children`, Vue's `${Event}Capture`, `Once` and `Passive`
    options, `children?: never` on void tags, and `v-model` with `_trim`, `_lazy` and `_number` on
    `input`, `textarea` and `select`. It adds `component` (a required `is`, with the upstream's
    `is?: string` omitted to avoid TS2430) and custom elements (`${string}-${string}`).
  - `IntrinsicAttributes` holds only `key`. Layer 1 lives in
    `LibraryManagedAttributes<C, P> = C extends TypedComponent ? P & Pick<…, "ref" | "class" | "style"> : P & ComponentAttributes`,
    where `ComponentAttributes` has `key`, `ref`, `class`, `style`, children or a slot object,
    `v-model`, `v-model:${string}` and
    `[event: on${Capitalize<string>}]: (...payload: any[]) => unknown`. This departs from §5.6's
    wording ("IntrinsicAttributes accepts…"): stock behaviour and all probes are identical, but a
    mapper-branded component can drop the open signatures.
  - The brand and the ref phantom are declared once, in this module, because unique symbols are
    per declaration.
  - `/// <reference path="./client.d.ts" />` brings in `declare module "*.css" {}`, so
    `import "./Counter.css"` passes TypeScript 7's `noUncheckedSideEffectImports`.
- **The authoring tsconfig** sets `jsx: "preserve"`, `jsxImportSource: "unframework"`,
  `declaration: false` and `isolatedDeclarations: false`, because the repo's `tsconfig.base.json`
  gives TS9013 on every exported component without an explicit return type. Under `preserve`, tsgo
  still resolves `unframework/jsx-runtime` for the `JSX` namespace, but no `jsx` export is needed.
- **Probes** live in `probes/{fixtures,caught,allowed}` and run with `scripts/run-probes.ts`. The
  gate is `tsc -p probes/tsconfig.json` exiting 0, so every `@ts-expect-error` must be used and
  `allowed/` must be clean. The pin re-checks with every directive disabled, and each
  `// @ts-expect-error TSxxxx why` (or `{/* @ts-expect-error TSxxxx why */}` in JSX) must be met by
  exactly that code on the next line. Probes set `skipLibCheck: false`, so a bad re-vendor fails.

## Consequences

**Positive:**

- Stock tsgo catches 53 pinned mistakes, among them `<div clas>`, `disabled="yes-please"`,
  `class={42}`, `style={{ colour }}`, an unknown tag, a void element with children, a ref of the
  wrong element type, and React's `className`, `htmlFor`, `onKeyDown` and `onDoubleClick` (each
  TS2322). On components: a wrong signature prop, missing or misspelt props, a lowercase `onchange`
  and an undeclared `id`. On the API: an unknown emit or wrong payload, `defineModel()` with no name
  (TS2554), a write to a computed (TS2540), an unchecked `inject` (TS18048) and a bare `JSX`
  (TS2503).
- Legitimate consumer code gets no false errors: `on*` handlers, `v-model` and `v-model:x`, slot
  objects, children, `key`, `ref`, and `class` and `style` fallthrough.
- An explicit `onX` prop wins over the index signature, with its payload checked. Layer 3 relies on
  this.

**Negative:**

- Deliberate blind spots, pinned as clean code in `allowed/`: event payloads, unknown events, model
  names and types, and undeclared slot keys on components (the compiler and the mapper catch these);
  `v-model` on a `div`; the open string unions (`type`, `autocomplete`); and JSX in variables,
  in-place mutation and early returns (compiler diagnostics, §4.6). TypeScript never checks an
  undeclared hyphenated attribute, so `aria-hiddenn`, `v-modl` and `v-model:opne` are caught only
  by the compiler, even under the mapper.
- About 1,200 lines of third-party types live in the repo, and `csstype` becomes a types-only
  dependency.
- Authors write `import { type JSX } from "unframework"` to name `JSX.Element`.
- The mapper needs `--runExternalCode` (CLI), `runExternalCode: true` (API) and trusted workspaces.
  TS 7.0.2 silently ignores `contentMappers`, so one tsconfig serves both versions. Declarations
  emitted for a mapped file are named `Counter.d.uf.tsx.ts`. The protocol is unstable until 7.1
  ships (planned 24 November 2026), and the SDK, `ts-content-mapper@0.1.0`, is third-party.

**Open:**

- Whether components accept undeclared global attributes (`id`, `title`, `role`). Today
  `<Counter id="x" />` is a pinned TS2322, and adding all of `HTMLAttributes` risks conflicting
  intersections.
- Whether `defineModel`'s `default` also takes a factory, or whether ADR-0008 makes a value enough.
- The VS Code native-preview extension with `runExternalCode` was not tested.
- Re-verify the protocol and the SDK on 7.1 stable before M5 commits to them.
- Feed `allowed/` through the compiler once layer 2 exists, to assert each "caught by the compiler".
- Whether the vendored `.d.ts` is copied as is at publish time; tsdown does not copy `.d.ts` inputs.

## Alternatives considered

- **Open attributes in `IntrinsicAttributes`, as §5.6 words it.** Implemented first, and every
  probe passed. Rejected because `IntrinsicAttributes` is intersected into every component, so even
  a mapper-typed one would accept `onChnage`.
- **v1's blanket `[attr: string]: any`.** Three caught probes went silent (TS2578).
- **No `on${Capitalize<string>}` signature.** False TS2322 and TS7006 errors on every `onChange`.
- **A global `JSX` namespace.** It would collide with host apps' JSX namespaces.
- **`JSX.Element` as `unknown`, `any` or a DOM `Node`.** These lose the check on non-JSX returns and
  imply a runtime shape that varies by target.
- **React's or Solid's element types.** D13 chose Vue's names (ADR-0017).
- **`.uf` instead of `.uf.tsx`.** See Decision. Editors do not activate TypeScript for unknown
  languages (microsoft/TypeScript#64355), and extensionless lookup of mapper extensions is still
  open (#64549, #64546).

## Evidence

- **The package:** `tsc -p packages/unframework/tsconfig.json` exits 0 with `isolatedDeclarations`
  and `skipLibCheck: false`, after `Omit<…, "is">` fixed a TS2430.
- **Vendoring:** `node packages/unframework/scripts/vendor-jsx.ts` wrote 1256 lines from upstream
  lines 96–1311. Editing `onKeydown` to `onKeyDown` made `--check` report `has drifted` (exit 1),
  and the probe gate failed with `Did you mean 'onKeyDown'?`.
- **Counter:** with the repo's base config, TS2882 on `./Counter.css` and TS9013. With `client.d.ts`
  and the authoring overrides, exit 0, including a consumer using `onChange` and `class`.
- **Probes:** `node scripts/run-probes.ts` printed
  `probes: OK - gate clean in ~200 ms, 53 caught probes pinned to their codes`, on 7.0.2 and on the
  7.1 nightly. `--extendedDiagnostics`: 90 files, 64,710 types, 0.131 s check time, 103 MB. The pin
  corrected seven guessed codes (TS2551, TS2747, TS2820, TS2353, TS2769, TS2322, TS2344), and found
  that `@ts-expect-error-disabled` is still a directive, because TypeScript's regex has no word
  boundary.
- **Breaking the probes:** fixing `<div clas>` gave TS2578 and exit 1; adding
  `[attribute: string]: any` gave three TS2578; removing the `on*` signature gave TS2322 and TS7006
  in `allowed/`. Removing `v-model:${string}` changed nothing, while a declared
  `"v-model:open"?: boolean` was checked.
- **Stubs:** `ref(1)` threw ``unframework: `ref` is compile-time only…``.
- **The nightly:** `tsc --help --all` lists `--runExternalCode`, and the binary carries diagnostics
  18065–18110. The source (gitHead 9adc871) and
  `TestGetContentMapperForFileNameUsesLongestExtension` confirm the extension rules above.
- **Mapper on `.uf.tsx`** (built on `ts-content-mapper@0.1.0`): without `--runExternalCode`, TS18068
  and native checking. With it, `App.tsx(11,16)` reported
  `TS2322 '(value: string) => string' is not assignable to '(value: number) => void'` and
  `App.tsx(12,16)` `onChnage … Did you mean 'onChange'?`. An injected error was reported at
  `Counter.uf.tsx(18,5)`, as on stock. `./Counter.uf.tsx`, `./Counter.uf` and `./Counter.uf.js`
  all resolved. Stock 7.0.2 gave only the layer-1 result.
- **Project system:** through `API({ runExternalCode })`, completions after `<Counter ` were
  `["initial?","step?"]` without the mapper and `["initial?","step?","onChange?"]` with it.
- **Validation:** registering `.tsx` gave TS18066, `uf.tsx` TS18065. `.uf` under 7.0.2 gave
  `TS2307 Cannot find module './Counter.uf'`. `--emitDeclarationOnly` wrote `Counter.d.uf.tsx.ts`.
