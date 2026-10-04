# ADR-0035: Render expressions are a scope-analysed subset that every target reads alike

- **Status:** Accepted
- **Date:** 2026-10-02
- **Plan:** §4.5 (Determinism), §4.6, §5.3, §5.4, §9 M1; G5, P2, P3, P4, P5, P8; R4, R5;
  ADR-0002, ADR-0032, ADR-0033

## Context

M1 puts JavaScript expressions in the returned JSX: children, attribute values, conditions, list
sources and keys, class and style parts, spread sources, and prop defaults. Plan §5.4 asks for a
real scope analysis, references recorded in the IR rather than AST objects (P5), and rewriting by
splicing at reference spans.

Three of the targets do not run the expression as JavaScript:

- **Angular 22's template language is a subset with its own lexer.** It rejects some syntax that
  TypeScript accepts, misreads some string escapes without an error, and cannot see globals or
  imports, only class members.
- **Vue** decodes character references inside `{{ }}` and directive values, and ends an
  interpolation at the first `}}`.
- **Svelte** wraps template expressions in deriveds and throws when one mutates state.

A construct that one target cannot read the same way must be rejected at the source, for every
target, or the difference shows up only in a test (P4). Some checks also need to know what kind of
value an expression yields, before M5's type oracle exists.

## Decision

- **Scope analysis** is `@typescript-eslint/scope-manager`, pinned exactly (it shapes the IR, P8),
  run as `analyze(program, { sourceType: "module", jsxPragma: null, lib: [] })` over oxc's AST
  parsed with `range: true`. A reference is classified by its definition:
  - a **prop**: a destructured local, or `props.x` in the object form, where the reference covers
    the whole member expression (the analyzer tracks parents itself; oxc has none);
  - a **loop variable**: the item or index of an enclosing `.map` lowered to a For (ADR-0036);
  - a parameter of an arrow function inside the expression: local, not recorded;
  - an **allowed global** (`ALLOWED_GLOBALS` in `@unframework/ir`): `undefined`, `NaN`,
    `Infinity`, `Math`, `Number`, `String`, `Boolean`, `Array`, `Object`, `JSON`, `parseInt`,
    `parseFloat`, `isNaN`, `isFinite` and the four URI functions (`encodeURIComponent`, …);
  - a setup declaration or an `unframework` import: UF1002, "lands in M2";
  - a nondeterministic name: UF3019 (below), never also UF3020;
  - anything else (`window`, `arguments`, the component's own name): UF3020 `unresolved-reference`.
- **The IR records references, not syntax.** An `Expression` is `{ code, span, refs }`, with `code`
  exactly the source slice and `refs` either a `Binding` (a prop or loop variable, by
  `name@offset` id, with `shorthand` for `{ label }`) or a `Global`. Targets rewrite by splicing
  at those spans. Plugin IR may move, copy or drop analysed expressions but never create one:
  `compile()` requires each to deep-equal an expression the analyzer produced (building on
  ADR-0032).
- **Each target rewrites references its own way.** Solid reads a prop as `props.x` and a list
  index as `index()`. Angular reads a prop as `x()` and, because its templates see only class
  members, declares each global an expression reads as one (`protected readonly Math = Math;`).
- **Shadowing is rejected** (UF3024 `shadowed-binding`). A list or arrow parameter that shadows a
  prop, an enclosing loop variable or an allowed global, or is named `props` or `rawProps`, would
  capture a target's rewrite (Solid's `props.label`, Angular's `label()`).
- **The accepted syntax:** string, decimal number, boolean, `null` and regex literals; template
  literals; ASCII identifiers; member access (dot, bracket, optional); calls and optional calls;
  array literals without holes and object literals with identifier or string keys, with spreads;
  arrow functions only as call arguments, with plain identifier parameters and an expression body;
  unary `! - + typeof`; arithmetic, equality and relational binary operators; `&& || ??`; the
  conditional operator; parentheses. `==` and `!=` are accepted: they render alike, and L5 judges
  the emitter's idiom, not the author's (ADR-0042).

**Not yet (UF1002).** Each exclusion names the reason, so it can be lifted when that reason goes:

| Construct                                                      | Reason                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| block-body arrows (safe fix to `=> e` for a lone `return e`)   | Angular: "Multi-line arrow functions are not supported" |
| arrow parameters with patterns, defaults, annotations or rest  | Angular's parser rejects each                           |
| `as`, `!`, `satisfies`, type arguments on calls                | Angular templates have no TypeScript syntax             |
| `0x10`, `0o7`, `0b1` (safe fix: the decimal value)             | Angular: "Unexpected token"                             |
| `\u{…}` escapes (safe fix: `\uXXXX` pairs)                     | Angular: "Invalid unicode escape"                       |
| array holes, `Array(…)` calls                                  | Angular rejects holes; holes iterate differently        |
| computed keys, methods, getters and setters in object literals | Angular: NG5002                                         |
| non-ASCII identifiers                                          | Angular's lexer is ASCII-only                           |
| `new`                                                          | Angular: NG5002                                         |
| bitwise operators                                              | `\|` is Angular's pipe                                  |
| `in`, `instanceof`, tagged templates, BigInt literals          | no M1 case needs them; each waits for a probe           |

- **Literals Angular misreads are re-printed.** Angular reads `"\x41"` as `x41` without an error.
  The Angular dialect re-prints string, template and number literals from their cooked values with
  the escapes its lexer reads, and drops comments, which Angular expressions cannot hold. Every
  other printer reproduces the source as written (literals, spacing and comments), escaped only for
  its template language: Vue and Angular decode `&`, and Vue ends an interpolation at `}}`.
- **Render is pure** (UF3021 `impure-render-expression`, §4.5): assignment and update, `delete`,
  `void`, sequences, `await`, `yield`, `this`, `super`, `import()`, `import.meta`, function and
  class expressions, an arrow anywhere but a call argument, and calls of mutating methods by name,
  whatever the receiver: `sort`, `reverse`, `splice` (safe fixes to `toSorted`, `toReversed` and
  `toSpliced`), `push`, `pop`, `shift`, `unshift`, `fill` and `copyWithin`, and `Object.assign`,
  `defineProperty`, `defineProperties`, `setPrototypeOf`, `freeze`, `seal` and
  `preventExtensions`.
- **Render is deterministic** (UF3019 `nondeterministic-render`, §4.5): `Date`, `Intl`, `crypto`,
  `performance`, `globalThis`, `Math.random` (by dot, bracket or optional access), and calls of any
  member named `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString`, `toLocaleUpperCase`,
  `toLocaleLowerCase` or `localeCompare`.
- **Nullish operators need a nullable operand** (UF3023 `non-nullable-operand`, safe fix: remove the
  operator). `a ?? b`, `a?.b`, `a?.[b]` and `a?.()` are rejected when the left side's kinds exclude
  `null` and `undefined`, as Angular's extended diagnostics do.
- **Value kinds** are an analyzer-internal, syntactic type model, used only for checks and never
  written to the IR: `string`, `number`, `boolean`, `null`, `undefined`, `bigint`, `symbol`,
  `object` (with members), `array` (with element kinds), `function` and `unknown`, as a set, with
  literal unions kept. They come from the props' member types (an optional member without a default
  adds `undefined`), from literals and operators by JavaScript's rules, from member access through
  known types (an index into an array adds `undefined`, as `noUncheckedIndexedAccess` does), from
  known string, array and number methods and global functions, and from loop variables. Anything
  else is `unknown`, which every check accepts. UF3016, UF3018 and UF3023 read them.
- **Run-time values outside the contract.** Specs and the render-parity kit never use these, and
  the compiler does not "handle" them: duplicate keys in one list; sparse arrays; non-finite
  numbers in attributes, or as the only child; numbers outside a numeric attribute's canonical
  range; empty strings on URL attributes; `javascript:` and `data:` URLs in bound URL attributes;
  a string that starts with `\n` as the first child of `pre` or `listing`; class tokens repeated at
  run time; CSS values holding `;` or `!important`; spread objects with keys beyond their declared
  type (ADR-0037 to ADR-0039).

```text
Source   <p>{label.toUpperCase()} ({count ?? 0})</p>      label: string; count?: number
React    <p>{label.toUpperCase()} ({count ?? 0})</p>
Solid    <p>{props.label.toUpperCase()} ({props.count ?? 0})</p>
Vue      <p>{{ label.toUpperCase() }} ({{ count ?? 0 }})</p>
Angular  <p>{{ label().toUpperCase() }} ({{ count() ?? 0 }})</p>
```

## Consequences

**Positive:**

- Every expression is analysed before it reaches an output (P2), and every exclusion names the
  target that forced it, so it can be lifted when that target changes.
- Rewrites never capture a name, and the outputs keep the author's spelling where the target
  allows it.
- Rendering stays a pure function of props (§4.5), on every target and in SSR and the browser.

**Negative:**

- Authors lose syntax that TypeScript accepts: block-body arrows, type assertions, hex literals,
  destructured arrow parameters. Most have a safe fix; the rest name Angular as the reason.
- Value kinds are approximate: falsy narrowing keeps the left side's kinds, and what the analyzer
  cannot type is trusted until M5.
- The Angular dialect re-prints literals, so its output can differ in spelling from the source.

**Open:**

- M2 adds setup bindings (`ref`, `computed`, locals) as new reference kinds, and decides how much
  of the excluded syntax handlers may use.
- M5's type oracle replaces syntactic value kinds where it can.

## Alternatives considered

- **An in-house resolver over oxc's visitor keys.** No dependency, but the plan asks for a real
  scope analysis, and M2's setup code grows the scopes quickly. scope-manager is TypeScript-aware
  and needs no TypeScript API.
- **`eslint-scope` or oxc-walker's `ScopeTracker`.** `eslint-scope` makes identifiers in type
  annotations references; `ScopeTracker` documents that it does not mirror JavaScript's scoping.
- **TypeScript's checker for scopes and kinds.** TypeScript 7.0 has no JavaScript API, and only the
  test toolchains and M5's `type-oracle-tsgo` may load one.
- **Accept all of JavaScript and let Angular's L3 fail.** A difference found only by a test breaks
  P4, and the author gets an Angular error for a source that names no Angular.
- **Re-print every expression through oxc-codegen.** It minifies numbers (`1000` becomes `1e3`),
  drops comments, and would make the JSX targets differ from the markup targets in spelling.
- **Record expression-local names in the IR,** so targets can pick names that do not capture. It
  adds a field only to avoid a rename the author can make.

## Evidence

- scope-manager 8.71.0 on oxc 0.152 ASTs (`range: true`, `lib: []`) resolves destructured props,
  defaults, shorthand properties, optional chains, `.map` parameters and nested arrow parameters,
  with UTF-16 offsets after astral characters. It does not crash on enums, namespaces, decorators,
  `declare` blocks or class static blocks. `arguments` resolves to an implicit function variable,
  the component's name to its function declaration, and only true globals stay unresolved. It
  depends only on `@typescript-eslint/types` and `visitor-keys`, with no TypeScript peer.
- `@angular/compiler` 22.2.1 `parseTemplate` rejects block-body arrows; destructured, annotated,
  defaulted and rest parameters; type arguments; `0x1F`, `0o7` and `0b1`; `'\u{1F600}'`; block
  comments; array holes; computed keys; object methods and getters; `new Date(0)`; and `é`. It
  reads `"\x41"` as `x41`, `"a\0b"` as `a0b` and `"a\bb"` as `abb`. It accepts expression-body
  arrows, regex, spreads, `?.`, `??`, `**`, `typeof`, template literals, `1e21`, `1_000` and quoted
  keys, and compiles `?.` with JavaScript's semantics.
- With the Angular toolchain's `extendedDiagnostics.defaultCategory: "error"`, `tone() ?? "x"` on a
  non-nullable input fails with NG8102 and `o()?.a` with NG8107. TypeScript accepts both.
- Svelte 5.57.1 compiles `{items.sort((a, b) => a - b).join(", ")}` into a derived, and with a
  `$state` props proxy the sort throws `state_unsafe_mutation`.
- Node 24 formats `(1234.5).toLocaleString()` as `1,234.5` under `en_US` and `1.234,5` under
  `de_DE`; Chromium uses its own locale.
- oxc-codegen 0.152 prints `1000` as `1e3`, `0x10` as `16` and `0.50` as `.5`; oxfmt keeps `1e3`.
- Vue 3.5.43 renders `{{ "&amp;" }}` as `&`.
- `jsx/expressions` and `jsx/escaping` are green at every live layer on all seven targets
  (to verify in M1).
