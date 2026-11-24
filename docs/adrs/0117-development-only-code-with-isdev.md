# ADR-0117: Development-only code with `isDev`

- **Status:** Accepted
- **Date:** 2026-11-22
- **Plan:** §4.2 (the authoring API), §5.6, §6, §7.3, §9 M3; P2, P3, P4, P6, P7; R1; ADR-0006,
  ADR-0033, ADR-0045, ADR-0048, ADR-0069, ADR-0077, ADR-0078; amends ADR-0045 (a top-level `if`
  of the setup, and a new reference kind)

## Context

A component should warn its author about a mistake, like a button with no accessible name (the
Open Components standard's `button/dev-warnings`), without shipping the warning to production.
Every framework has its own way to say "development only", and none of them is portable:

- React, Vue and Svelte libraries test `process.env.NODE_ENV !== "production"`, which bundlers
  replace.
- Angular declares the global `ngDevMode`, which a production build defines as `false`.
- Solid exports `isDev` from `solid-js/web` (Solid 2 from `@solidjs/web`), and Qwik from
  `@qwik.dev/core/build`. Their export conditions pick the development or production build.
- Astro builds with Vite, which reads `import.meta.env.DEV`.

Setup code rejects `import.meta` (ADR-0045), and a top-level `if` of the setup was UF1002, so a
component had no way to write any of these.

## Decision

**The construct.** A component imports `isDev` from `@uxfront/unframework`, a `boolean`
constant, recognised by its import's binding like every authoring API (ADR-0006). It is read in
one form only: as the whole test of an `if` statement with no `else`.

- **At the top level of the setup**, `if (isDev) { … }` is a new setup item, `DevCheck`. Its block
  runs once where the target runs the setup, in source order. It reads what pure code reads (the
  props, state, derived values, constants), plus `console`. It writes nothing the component
  holds, so a development render and a production one are the same, and hydration can't differ.
  Inside it, names it declares itself are free: block-local `const` and `let`, their writes,
  `if`, loops and a nested `if (isDev)`.
- **In client code** (a handler, a watcher's callback, `watchEffect`, a lifecycle hook and the
  functions they call), `if (isDev)` is ordinary client code.

In both places, the test is a `Dev` reference in the IR, which each target respells.

**Diagnostics.** One new code, **UF2040 `misplaced-dev-check`** (error): `isDev` read anywhere
else. That covers an `else`, a negation, a value, a logical expression, a call, a template, a
getter, and any use in a composable (`.uf.ts`) or a directive's hook. A template, a getter or an
initial value that calls a local function which tests `isDev`, itself or through what it calls,
is UF2040 at the call: the render, or the value, would differ in development, and Solid's server
reads its `isDev` as `false`, so hydration would differ too. Client code may call one.

A component that reads `isDev` declares nothing named `process` or `ngDevMode`: a prop, a
setup binding, a local or a parameter of that name would shadow the global React, Vue, Svelte
or Angular's check reads, so it is UF2003. Solid, Solid 2 and Qwik import their flag under a
free name instead.

In the top-level block, pure code's rules hold with their own codes:

| In the block                                          | Code                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A write of state, a model or a setup `let`            | UF2011                                                                                      |
| An emit                                               | UF2017                                                                                      |
| A call of a setup function                            | UF2014                                                                                      |
| A browser global but `console` (`window`, `document`) | UF3020                                                                                      |
| A `return`                                            | UF2012                                                                                      |
| An `await`                                            | UF2038 in an `async` component, as at the top level, and a syntax error (UF1001) in another |
| A read of a binding declared after the block          | UF2023, as for any setup item: the block runs in source order                               |

A `throw` is allowed: a block may fail loudly in development, as an invariant check does, where
a production build renders on.

**Each target's check.** The test is respelled, and the block placed where the target already
runs setup-time reads of the props:

| Target  | `if (isDev)`                                                 | The top-level block                                                |
| ------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| React   | `if (process.env.NODE_ENV !== "production")`                 | The component's body, on every render (R1)                         |
| Vue     | `if (process.env.NODE_ENV !== "production")`                 | `<script setup>`                                                   |
| Svelte  | `if (process.env.NODE_ENV !== "production")`                 | The instance script, in `untrack` where it reads a prop or state   |
| Solid   | `import { isDev } from "solid-js/web"`, `if (isDev)`         | The body, in `untrack` where it reads a prop or state              |
| Solid 2 | `import { isDev } from "@solidjs/web"`, `if (isDev)`         | The body, in `untrack` where it reads a prop or state              |
| Angular | `if (typeof ngDevMode === "undefined" \|\| ngDevMode)`       | `ngOnInit`, once the inputs are set                                |
| Qwik    | `import { isDev } from "@qwik.dev/core/build"`, `if (isDev)` | The `component$` body, in `untrack` where it reads a prop or state |
| Astro   | `if (import.meta.env.DEV)`                                   | The frontmatter                                                    |

- No capability is added: every target runs the block natively.
- `isDevMode()` is not Angular's spelling: it calls into `@angular/core`, so no bundler can drop the
  block.
- Svelte has no public flag a library may import. SvelteKit's `dev` from `$app/environment`
  exists only in a SvelteKit app, and `esm-env` is no dependency of the output (P7).
- React runs its body on every render, so its block runs on each one, more than once under
  StrictMode, as React's own render-time warnings do. Tests check that a warning shows, never how
  many times.
- On the server, React, Vue and Svelte read `process.env.NODE_ENV` at run time: Vite replaces it
  only in client code. So a production server needs `NODE_ENV=production`, as React and Vue
  themselves need. Solid's server build always reads `isDev` as `false`.
- A packaged output (`unframework build --package`, ADR-0077) keeps each check as written, so the
  app's build decides.

**Toolchains.** The toolchain projects set `"types": []`, so `process` is undeclared there. React,
Vue and Svelte's toolchains declare it in `environment.d.ts`, standing in for the `@types/node`
or bundler types an app has. The output declares nothing.

**The production proof.** Each `toolchain:<target>` project runs `harness/dev-only.test.ts` too.
For each `cases/dev/*` case, it runs the target's framework compile, then bundles twice with
rolldown:

- A production build: `process.env.NODE_ENV` set to `"production"`, `ngDevMode` to `false`,
  `import.meta.env.DEV` to `false`, the `production` export condition, minified. The warning's
  text must be gone.
- A development build: `"development"`, `ngDevMode` left undefined, `import.meta.env.DEV` set to
  `true`, the `development` condition. The text must be there, so the production assertion can't
  pass by accident.

Only the framework's own flag module is bundled, so the condition picks its value; every other
package stays external. Qwik's optimizer folds its `isDev` itself, so `ToolchainContext` gains an
optional `mode`, which Qwik's `frameworkEmit` reads. Where the case's code can't run on a target,
because the target declares a capability it needs unsupported (its expected UF4001, as for a hook
on Astro), both bundles must lack the text. That is an assertion, not a skip: it fails if the
target ever emits that code with no check.

For example, this source:

```tsx
export default function IconButton({ label }: { label?: string }) {
  if (isDev) {
    if (!label) console.warn("IconButton has no accessible name: pass it a `label`.");
  }
  return (
    <button type="button" aria-label={label}>
      …
    </button>
  );
}
```

compiles to `if (process.env.NODE_ENV !== "production") { … }` in React's body, and to
`if (isDev) { … }` with `isDev` from `solid-js/web` in Solid's.

## Consequences

**Positive:**

- A component can warn its author in development on all eight targets, and a production build
  drops the warning on each, which a test proves per target.
- Each output reads as a developer of its framework writes development-only code.

**Negative:**

- On React, Vue and Svelte, a production server must set `NODE_ENV=production`, or its render
  warns too.
- React's block runs on every render.
- `isDev` is one more name `@uxfront/unframework` exports, and the only constant among its
  functions. Read uncompiled, it is `true`.

## Alternatives considered

- **`import.meta.env.DEV` in the source.** ADR-0045 rejects `import.meta`. It is Vite's spelling,
  and Angular, Solid and Qwik have flags of their own.
- **A callback macro, `onDev(() => …)`.** It adds a function scope, and a bundler can't drop a
  call as surely as an `if` whose test it folds to `false`.
- **`isDev` as a free value** (`isDev && x`, `const d = isDev`, in a template). A development
  render and a production one could differ, and the output's check could no longer be a plain
  statement a bundler folds.
