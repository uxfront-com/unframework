# ADR-0035: Render expressions are a scope-analysed subset that every target reads alike

- **Status:** Accepted, amended by ADR-0045
- **Date:** 2026-10-05
- **Plan:** §4.5 (Determinism), §4.6, §5.3, §5.4, §9 M1; G5, P2, P3, P4, P5, P8; R4, R5;
  ADR-0002, ADR-0033; amends ADR-0032

## Context

M1 puts JavaScript expressions in the returned JSX: children, attribute values, conditions, list
sources and keys, class and style parts, and spread sources. Plan §5.4 asks for a real scope
analysis, references recorded in the IR rather than AST objects (P5), and rewriting by splicing at
reference spans. Prop defaults are not render expressions: they are static values (ADR-0034).

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
    the whole member expression. Any other use of the props object is UF2001, and `props?.x` is
    UF3023;
  - a **loop variable**: the item or index of an enclosing `.map` lowered to a For (ADR-0036);
  - a parameter of an arrow function inside the expression: local, not recorded;
  - an **allowed global** (`ALLOWED_GLOBALS` in `@unframework/ir`): `undefined`, `NaN`,
    `Infinity`, `Math`, `Number`, `String`, `Boolean`, `Array`, `Object`, `JSON`, `parseInt`,
    `parseFloat`, `isNaN`, `isFinite` and the four URI functions (`encodeURIComponent`, …);
  - any variable or import declared outside the template, in the component's setup code, the
    module or another module: UF1002, "reading it lands in M2";
  - a nondeterministic name: UF3019 (below), never also UF3020;
  - anything else (`window`, `arguments`, the component's own name, a module function): UF3020
    `unresolved-reference`, whose help names a prop or loop variable one edit away.
- **The IR records references, not syntax.** An `Expression` is `{ code, span, refs }`, with `code`
  exactly the source slice and `refs` either a `Binding` (a prop or loop variable, by
  `name@offset` id, with `shorthand` for `{ label }`) or a `Global`. Targets rewrite by splicing
  at those spans, and expand a shorthand only when its spelling changes. Plugin IR may move, copy
  or drop analysed expressions but never create one: `compile()` requires each to deep-equal, in
  code, span and references, an expression the analyzer produced, and reports UF8001 otherwise.
  The same rule holds for prop types and copied type declarations (building on ADR-0032).
- **Amendments to ADR-0032.** The invariants check what the analyzer guarantees of expressions:
  each is its source text and refers only to bindings in scope where it sits and to the allowed
  globals; a reference spans a prop's name exactly, or in the object form the parameter's member
  (`props.label`, so no parenthesised `(props).label`); and a loop variable takes no name that
  UF3024 rejects (`reservedParameterName` in `@unframework/ir`), nor a prop's, the props
  parameter's or an enclosing loop variable's.
- **Each target rewrites references its own way**, and claims every name it introduces around the
  names the source's expressions use (`sourceNames` and `NameScope` in `@unframework/codegen`):
  - Solid reads a prop as `props.x` (from `mergeProps`, or the author's own object name) and a
    list index as `index()`;
  - Angular declares one `@let x = this.x();` per prop the template reads, and expressions read
    `x`, so that Angular's type checker narrows it as TypeScript narrows a local; a list's `track`
    reads `this.x()` (ADR-0034). Its templates see only class members, so each global an
    expression reads is one, sorted by name (`protected readonly Math = Math;`), except
    `undefined`, an Angular keyword;
  - Vue destructures a prop named after a global its template compiler never prefixes (`Map`,
    `console`, …) or after a compiler macro under a fresh local (`{ Map: Map_1 }`), and the
    template reads the local;
  - React, Qwik, Svelte and Astro keep the names as written.
- **Shadowing and unread parameters are UF3024 `shadowed-binding`.** A list or arrow parameter is
  rejected when it would capture a target's rewrite or a name an output declares: the name of a
  prop, of the object form's parameter, of an enclosing loop variable or of an allowed global;
  `props`, `rawProps` and `Fragment` (Astro's output imports it to render `<>`); any name starting
  with `$` (Angular's `@for` declares `$index`, `$count`, `$first`, …); and any name starting with
  `_` but `_` itself (Vue's compiled render functions declare `_ctx`, `_cache`, `__props` and
  helpers); and `as`, an Angular expression keyword, which Angular's templates cannot read as a
  name (its other keywords are reserved words, or the global `undefined`). An arrow function's
  trailing parameters that nothing reads are UF3024 too, because the JSX targets'
  `no-unused-vars` rejects them (ADR-0042); the safe fix removes them. A parameter named in a part
  of the expression that is reported without being analysed (JSX as a value, an impure or an
  unsupported construct) counts as read, so the fix never removes one that part uses. A list's
  parameters are never reported as unread: every target leaves an unread index out.
- **The accepted syntax:** string, decimal number, boolean, `null` and regex literals; template
  literals; identifiers written in ASCII; member access (dot, bracket, optional); calls and
  optional calls, with spread arguments; array literals without holes and object literals with
  identifier or string keys, with spreads; arrow functions only as call arguments, with plain
  identifier parameters and an expression body; unary `! - + typeof`; arithmetic, equality and
  relational binary operators; `&& || ??`; the conditional operator; parentheses. `==` and `!=`
  are accepted: they render alike, and L5 judges the emitter's idiom, not the author's (ADR-0042).

**Not yet (UF1002).** Each exclusion names the reason, so it can be lifted when that reason goes:

| Construct                                                                         | Reason                                                   |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| block-body arrows (safe fix to `=> e` for a lone `return e`)                      | Angular: "Multi-line arrow functions are not supported"  |
| arrow parameters with patterns, defaults, annotations or rest; `async` arrows     | Angular's parser rejects each                            |
| `as`, `!`, `satisfies`, type arguments and type parameters                        | Angular templates have no TypeScript syntax              |
| `0x10`, `0o7`, `0b1` (safe fix: the decimal value)                                | Angular: "Unexpected token"                              |
| `\u{…}` escapes (safe fix: `\uXXXX` pairs)                                        | Angular: "Invalid unicode escape"                        |
| `typeof /re/` (safe fix: parentheses around the regex)                            | Angular's lexer reads the `/` as a division              |
| array holes, `Array(…)` calls                                                     | Angular rejects holes; holes iterate differently         |
| computed and numeric keys, methods, getters and setters in object literals        | Angular: NG5002                                          |
| identifiers outside ASCII, or written with escapes                                | Angular's lexer is ASCII-only                            |
| private names (`a.#x`, `#x in o`)                                                 | props and loop variables have no private members         |
| `new`                                                                             | Angular: NG5002                                          |
| bitwise operators                                                                 | `\|` is Angular's pipe                                   |
| `in`, `instanceof`, tagged templates, BigInt literals                             | no M1 case needs them; each waits for a probe            |
| `eslint`, `oxlint`, `global` and `@ts-…` directive comments (safe fix: remove it) | each output's L4 and L5 must judge the output as written |
| reading the text of a regex Angular respells (`/a;b/.source`, `String(/"x"/)`)    | Angular writes some of its characters as escapes (below) |

- **Literals Angular misreads are re-printed.** Angular reads `"\x41"` as `x41` without an error,
  and angular-eslint parses an inline template as the TypeScript template literal it is. So the
  Angular dialect re-prints string literals from their values, with only the escapes its lexer reads
  (`\n \r \t \v \f \\ \uXXXX`) and `\uXXXX` for control characters, separators, braces and `&`, `<`,
  `>`, in the quote the value does not hold (below); it writes template literals as concatenations
  (`n + "px"`, and `"" + a + b` where neither of the first two parts is a string), with parentheses
  only where `+` would bind wrongly; it keeps decimal numbers as written and prints others by value,
  parenthesises a number that a member access follows (`(1.5).toFixed(1)`, `(5).toString()`,
  `(1e3).toString()`), as its lexer takes every `.` after a number into it, and gives a leading-dot
  number after a `?` its `0` (`n > 1?0.5:1`), as its lexer reads `?.` as optional chaining; and it
  drops comments, which Angular expressions cannot hold. What Angular's template reads around the
  code is escaped too:
  - a regular expression's quotes, `;`, whitespace other than a lone space, and parentheses in a
    class are written as escapes (`/[;)(]/` as `/[\x3b\x29\x28]/`), because the lexers that find an
    interpolation's `}}`, a block parameter's `;` and `)`, and a comment's `//` read them; an
    escaped `/`, bracket or parenthesis is written as a code too (`\x2f`, `\x5b`, `\x5d`, `\x28`,
    `\x29`), because angular-eslint lints the raw text of the TypeScript template literal the
    template sits in, where the backslash is doubled and the character after it would be syntax; a
    body that would write `//` escapes its `/`, the first `{` of a `{{` is `\x7b`, which keeps the
    `{{` out of an attribute value, and in an interpolation a `<` before a letter is an escape, or
    `&lt;` where it opens a named group or a lookbehind. The escapes match the same text, so
    `.test()`, `.exec()`, `.flags` and the string methods (`replace`, `split`, …) read alike, but
    the regex's `source` and string form hold them: reading its text (`.source`, `String()`, a
    template literal, a `+`, or rendering it) is UF1002 where it holds any of these characters
    (`angularRespellsRegex` in `packages/ir/src/portability.ts`);
  - Angular decodes an interpolation's character references only once it has found its end, with
    `/&([^;]+);/`, so a bare `&` (of `a && b`) before a reference would take its `;`: in an
    interpolation that needs any reference, every `&` is written `&amp;`, and one that needs none
    keeps `&&` as written;
  - no backslash ever precedes a quote: angular-eslint's `extract-inline-html` reads the
    template's raw text, where `\'` is an escaped backslash and a quote that ends the string, and
    Angular ends an expression at a `//` outside quotes, which it tracks without escapes. So a
    string takes the quote its value does not hold: `'` by default in an attribute binding, where a
    `"` is written `&quot;` and decoded before parsing, and `"` in an interpolation or a block; a
    value that holds both writes its own quote as a `\u` escape. Literal text written as an
    interpolated string follows the same rule, and a regex's closing `/` before a division gets a
    space;
  - U+E500, which Angular's whitespace processing turns into a space everywhere, `<pre>`
    included, is an escape in a literal, and text holding it is an interpolated literal;
  - JavaScript's whitespace outside ASCII between tokens, which Angular's lexer rejects, is
    written as a space.
- **The other targets reproduce the source, escaped only for their template language.** Vue and
  Angular decode character references, so `&` before a letter, a digit or `#` is written `&amp;` in
  an interpolation or a bound value; Vue ends an interpolation at `}}`, so the printer separates the
  braces, or writes the brace as `\u007d` inside a literal; Vue writes a bound value's double-quoted
  strings with single quotes; Svelte parenthesises an interpolation that starts with a regex. The
  markup targets keep the author's text exactly, line breaks and indentation of a multi-line
  expression included. React, Solid and Qwik keep its tokens, but oxfmt formats their files
  (ADR-0041), which normalises quotes, spacing and numbers (`0.50` becomes `0.5`). A comment inside
  `{…}` but outside the expression's own span is dropped on every target.
- **Render is pure** (UF3021 `impure-render-expression`, §4.5): assignment and update, `delete`,
  `void`, sequences, `await`, `yield`, `this`, `super`, `import()`, `import.meta`, `new.target`,
  function and class expressions, an arrow anywhere but a call argument, and calls of mutating
  methods by name, by dot or bracket, whatever the receiver: `sort`, `reverse`, `splice` (safe
  fixes to `toSorted`, `toReversed` and `toSpliced`), `push`, `pop`, `shift`, `unshift`, `fill`
  and `copyWithin`, and `Object.assign`, `defineProperty`, `defineProperties`, `setPrototypeOf`,
  `freeze`, `seal` and `preventExtensions` on the global `Object`.
- **Render is deterministic** (UF3019 `nondeterministic-render`, §4.5): `Date`, `Intl`, `crypto`,
  `performance`, `globalThis`, `Math.random` (by dot, bracket or optional access), and calls of any
  member named `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString`, `toLocaleUpperCase`,
  `toLocaleLowerCase` or `localeCompare`.
- **Nullish operators need a nullable operand** (UF3023 `non-nullable-operand`), as Angular's
  extended diagnostics require. `a ?? b`, `a?.b`, `a?.[b]` and `a?.()` are rejected when the left
  side's kinds are known and exclude `null` and `undefined`, where it is read. The safe fix removes
  `?? b`, offered when `b` reported nothing and holds no comment, or writes `?.` as `.`.
- **Narrowing follows TypeScript's, on every target** (`narrowing.ts` in the analyzer). Every
  target narrows as TypeScript narrows the source: the JSX targets write its conditionals as it
  does, and Angular's, Vue's and Svelte's checkers read their template blocks as TypeScript does
  (Solid: ADR-0036). So a reference (a prop or a list's item, and static keys of it) that a
  condition around it tests loses `null` and `undefined` from its kinds there, by TypeScript's
  rules where the compiler follows them: a test of the value at any depth through `!`, `&&` and
  `||`, read as the condition holds or fails (a failing `a && b` is "`a` fails, or `a` holds and
  `b` fails"), so `!!x` and `!(x === undefined || on)` narrow `x`; the comparisons TypeScript
  narrows by, with `null` or `undefined` (the strict ones add up by the declared kinds, so
  `note !== undefined` alone leaves a nullable `note` as declared), with a value
  (`tone === "warn"`) and of `typeof`; a member read through `?.` (`box.inner?.title`);
  `Array.isArray`; and a discriminant of a union the reference is a member of
  (`plan.kind === "paid"` narrows `plan.renews`), whose kinds are read again from the remaining
  members. So `{box.inner && <p title={box.inner?.title} />}` is UF3023, with its safe fix to
  `box.inner.title`, and a narrowed list source lowers (`{box.items && box.items.map(…)}`).
- **Closures, list keys and the forms the compiler does not follow.** In TypeScript, a list's item
  or an arrow function's parameter keeps its narrowing inside a closure, and a property does not.
  A destructured prop counts as a parameter in a conditional child's branch (an `&&` child, or a
  `?:` that holds JSX), as Solid's keyed `<Show>` or `<Match>` passes its callback the narrowed
  value (ADR-0036) and the other targets read the source's own local: so
  `{maybe && <ul>{items.map((i) => <li key={i}>{maybe?.title}</li>)}</ul>}` is UF3023, with its
  fix to `.`. It counts as a property under an expression's own conditional (a ternary or an `&&`
  inside an interpolation or an attribute's value), which Solid copies with `props.x`, and so do
  the object form's props and members. A discriminant narrows the union reference itself, so a
  destructured prop or a list's item that one tests keeps it in a conditional child's closures
  (`{u.kind === "a" && <p>{items.map((x) => x + u.inner.title).join()}</p>}`). Angular's and the
  other template targets' loops keep a narrowing, and their arrow functions forget a member's.
  Angular's `track` reads a prop again from its input, which its checker never narrows.

  Where the targets' checkers read a value apart, a use that relies on its narrowing is UF1002,
  with the condition as related information. A use that reads alike whatever narrows the value is
  accepted: a test (`?:`, `&&`, `||`, `!`), `typeof`, the object of `?.`, the left of `??`, an
  equality, a template literal's part, a spread, a string concatenation, or a list key's value.
  A member read through `.`, a call's argument, arithmetic and a relational comparison rely on it.
  The rules, as probed against each checker:
  - across a list's callback, a `?.` or a `??` on a member Angular checks is NG8107 or NG8102 on
    Angular, and a `.` read of what TypeScript forgot fails the JSX targets: both are UF1002;
  - across an arrow function in an expression, Angular forgets a member's narrowing too, so `?.`
    passes every target; a use that relies on the narrowing
    (`query ? items.filter((item) => item.includes(query)) : …`) is UF1002, whose help asks for
    `?.`, for a value through `??` (`item.includes(query ?? "")`), or for the test inside the
    arrow function or in a conditional child;
  - in a list's key, a prop is never narrowed on Angular, so a use that relies on its narrowing
    (`key={count + i}`) is UF1002, whose help gives the key a value where the prop may be absent
    (`(count ?? 0) + index`, `label?.length ?? 0`);
  - an equality with a value that is no literal (`box.inner?.title === label`) narrows in
    TypeScript's own way, which the compiler does not follow: a `?.` or a `??` on a value Angular
    may narrow, and a `.` read of one some target may not, are UF1002. Nothing else that mentions
    a value (a relational comparison, arithmetic, `??`, a call's argument) narrows it, so it keeps
    its declared kinds there;
  - a member read of a value a condition shows absent (`{!box.inner && <p>{box.inner?.title}</p>}`),
    through `?.` too, is UF1002: TypeScript types the value `never` there, and the template
    targets' loops and Solid's keyed callbacks keep that. A falsy string is not absent:
    `{!label && <p>{label?.length}</p>}` is accepted.

  Angular does not check its own template variables (a prop's `@let`, a `@for` item), so for a
  prop or a list's item the help asks for `?.`, which every target then takes. These rules hold
  no kinds in the IR, so the invariants do not mirror them.

- **Value kinds** are an analyzer-internal, syntactic type model: `string`, `number`, `boolean`,
  `null`, `undefined`, `bigint`, `symbol`, `object` (with members), `array` (with element kinds),
  `function` and `unknown`, as a set, with literal unions kept. They come from the props' member
  types (an optional member without a default adds `undefined`, a default removes it), from
  literals and operators by JavaScript's rules, from member access through known types (an index
  into an array or a string adds `undefined`, as `noUncheckedIndexedAccess` does, and so do `at`,
  `find`, `pop` and `shift`), from known string, array and number methods and global functions,
  from loop variables, and for an arrow function's parameters from the array method it is passed
  to. Anything else is `unknown`, which every check accepts, an index into a value the model
  cannot type included (`key={entry[0]}` over `Object.entries`, a string to TypeScript). The
  conditions around a read narrow its kinds as TypeScript narrows its type (`narrowedKinds`):
  `typeof`, `Array.isArray`, truthiness, an equality with a literal and a discriminant keep or take
  out the kinds they test, in either branch (`typeof to === "string" ? to : to.join(", ")`,
  `action !== "go"` leaving the other literals), and a `?:` is the union of its branches, each
  narrowed. A discriminant is a member TypeScript reads as one, of a literal type in some of the
  union's shapes: a test of any other member narrows nothing. They narrow only where every target
  keeps the narrowing; where some target forgets it (a property in a closure, a prop in a key), a
  use that relies on the narrowed kinds is UF1002, as above. The kinds decide UF3016, UF3018,
  UF3023, ARIA's UF3008 for bound literals, and what a spread may render; only the spread's keys
  reach the IR.
- **Run-time values outside the contract.** Specs and the render-parity kit never use these, and the
  compiler does not "handle" them; the kit's reference evaluator
  (`packages/codegen/test/render-parity-reference.ts`) refuses them, its source generator avoids a
  leading line feed, and the templates page of the docs lists them: duplicate keys in one list
  (compared as strings); sparse arrays; `NaN` and the infinities wherever they would render, as
  text, in an attribute or in a style (as a condition `NaN` is falsy everywhere); numbers outside a
  numeric attribute's range; empty strings on URL attributes; `javascript:` and `data:` URLs in
  bound URL attributes; a string that starts with `\n` as the first child of `pre` or `listing`,
  or after an expression that renders `""` there;
  class tokens two parts produce at run time; CSS values holding `;` or `!important`; spread objects
  with keys beyond their declared type (ADR-0037 to ADR-0039). The evaluator also refuses the
  run-time side of every kind the analyzer trusts as `unknown`: a boolean or an object as text, a
  list source that is no array, a key that is neither a string nor a number, a number without a unit
  where CSS needs one.

```text
Source   <p>{label.toUpperCase()} ({count ?? 0})</p>      label: string; count?: number
React    <p>{label.toUpperCase()} ({count ?? 0})</p>
Solid    <p>{props.label.toUpperCase()} ({props.count ?? 0})</p>
Vue      <p>{{ label.toUpperCase() }} ({{ count ?? 0 }})</p>
Angular  @let label = this.label();
         @let count = this.count();
         <p>{{ label.toUpperCase() }} ({{ count ?? 0 }})</p>
```

## Consequences

**Positive:**

- Every expression is analysed before it reaches an output (P2), and every exclusion names the
  target that forced it, so it can be lifted when that target changes.
- Rewrites never capture a name, and the markup outputs keep the author's spelling where the
  target allows it.
- Rendering stays a pure function of props (§4.5), on every target and in SSR and the browser.

**Negative:**

- Authors lose syntax that TypeScript accepts: block-body arrows, type assertions, hex literals,
  destructured arrow parameters, parameter names starting with `$` or `_`, lint directives. Most
  have a safe fix; the rest name Angular or a target's output as the reason.
- Value kinds are approximate: falsy narrowing keeps the left side's kinds, and what the analyzer
  cannot type is trusted until M5.
- Narrowing the compiler does not follow, or that the targets' checkers read apart, is UF1002:
  authors test a value inside the closure that reads it, read it through `?.`, or give it a value
  with `??`. A member read of a value a condition shows absent is UF1002 too.
- The Angular dialect re-prints literals, and oxfmt re-spells the JSX targets' literals, so their
  outputs can differ in spelling from the source.

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
- **Re-print every expression through oxc-codegen.** It minifies numbers (`1000` becomes `1e3`,
  `0.50` becomes `.5`) and drops comments. Expressions enter oxc-codegen's ASTs only as
  placeholders, spliced in after printing.
- **Record expression-local names in the IR,** so targets can pick names that do not capture. It
  adds a field only to avoid a rename the author can make; the targets read the names from each
  expression's code instead, and claim their own around them.
- **Read Angular inputs as signal calls (`label()`), as first planned.** Angular's type checker
  never narrows a call, so `phone() && phone().length` fails TS2532 where the source type-checks.

## Evidence

- scope-manager 8.71.0 on oxc 0.152 ASTs (`range: true`, `lib: []`) resolves destructured props,
  defaults, shorthand properties, optional chains, `.map` parameters and nested arrow parameters,
  with UTF-16 offsets after astral characters. `arguments` resolves to an implicit function
  variable, the component's name to its function declaration, and only true globals stay
  unresolved. It depends only on `@typescript-eslint/types` and `visitor-keys`, with no
  TypeScript peer. `packages/analyzer/test/expressions.test.ts` pins the classification: "resolves
  props, globals and expression-local parameters", "marks a shorthand property", "reports %s as
  unresolved (UF3020)" and "reports %s as nondeterministic (UF3019), never also unresolved".
- `@angular/compiler` 22.2.1 `parseTemplate`: `packages/analyzer/test/m1-conformance.test.ts`
  "parses every accepted expression the generator writes" (1,500 seeded expressions, `"\x41"`,
  `1e3`, `1_000`, `.5`, regex, `?.`, `??`, template literals and quoted keys among them) and
  "rejects %s, which Angular cannot parse" (block arrows, destructured parameters, `0x1F`,
  `'\u{1F600}'`, holes, computed keys, `|`, `new Array(1)`, `typeof /a/`). Probes also showed it
  rejects annotated, defaulted and rest parameters, type arguments, `0o7`, `0b1`, block comments,
  object methods and getters and `é`, and reads `"\x41"` as `x41`, `"a\0b"` as `a0b` and `"a\bb"`
  as `abb`.
- `packages/codegen/test/markup-escape.test.ts`: "re-prints literals with the escapes Angular's
  lexer reads", "writes template literals as concatenations…" and "parenthesises a concatenation
  only where `+` binds wrongly", "writes escapes in a regular expression for what Angular's template
  reads in it", "writes a regular expression's `<` so that no interpolation opens a tag", "writes a
  string in the quote its value does not hold, or its own quote as an escape", "writes U+E500 in a
  literal as an escape, which Angular's whitespace processing keeps", "writes whitespace outside
  ASCII between tokens as a space", "escapes an ampersand only where it could start a character
  reference" and "keeps `{{` out of a regular expression"; `markup.test.ts` "writes an interpolated
  literal in the quote its text does not hold"; the markup cases "template literals, comments and
  regular expressions in code" and "U+E500 in text and in string literals". The markup case "escapes
  Angular's lexer reads differently…" and the kit's source "literal spellings Angular's lexer reads
  differently, and comments in code" render through Angular's own renderer
  (`packages/target-angular/test/markup-semantics.test.ts`, `render-parity.test.ts`), and so does
  the kit's source "apostrophes and quotes in strings, and escaped characters in regular
  expressions". `packages/target-angular/test/output.test.ts` runs L3, L4, L5 and SSR over its
  `Quotes` source, whose strings hold apostrophes, quotes and `//`.
- `packages/analyzer/test/expressions.test.ts` holds the rest of the rules: "reports %s as
  shadowing", "removes the unread trailing parameters of %s", "removes an unread parameter rather
  than report its shadowing too", the names Vue's compiled code, Astro and Angular's `@for`
  declare, "Angular's expression keywords" ("reports the parameter in %s (UF3024)"), "reads a
  parameter in %s as read" and "removes a parameter that a part the walk reports does not read",
  "rewrites %s to %s, which Angular reads", the impure and nondeterministic calls, the nullish
  operators and their fixes, and "lint and type-check directives"; its `props.test.ts` "reports
  the parenthesised object in %s (UF2001), and the fix removes it".
  `packages/ir/test/invariants.test.ts` breaks each amendment ("a loop variable named after a
  prop", "… named as an Angular keyword", "… named as Vue's compiled code names its own", "a prop
  read by its name in the object form", "a prop read as a member in the destructured form").
- With the Angular toolchain's `extendedDiagnostics.defaultCategory: "error"`, `tone() ?? "x"` on a
  non-nullable input fails with NG8102 and `o()?.a` with NG8107; through a `@let` variable a member
  read (`o.a ?? 1`) still fails, a bare variable does not. TypeScript accepts all of them, so
  UF3023 is the one rule for every target.
- `packages/analyzer/test/narrowing.test.ts` holds the narrowing rules, each case probed against
  Angular 22's compiler and every target's type check: "`?.` and `??` on a value a condition
  narrows on every target (UF3023)" (with "reports the object form's member, and its prop" and
  "lowers a list over a source a condition narrows"), "`?.` and `.` where the targets' checkers
  read a value alike", and "a value the targets' checkers read differently (UF1002)" (with "asks
  for `?.` on a prop a closure forgets the narrowing of, and accepts it" and "leaves a prop a
  comparison leaves nullable as it is declared: `!== undefined` keeps a `null`"), and "uses of a
  value some target does not see narrowed (UF1002)" (with "reports a member read of a value a test
  shows absent, across a list too" and "keeps a test it does not follow beside the nullish kinds a
  comparison takes out"), and "kinds a test narrows" (with "narrows the object form's props too"
  and "reports a property narrowed outside a list's callback, which TypeScript forgets there"); its
  cases cover `!!x`, `||`, discriminants, closures, list keys and the uses that need no narrowing.
  `packages/analyzer/test/lists.test.ts` "keys a list over `Object.entries` by the entry's name".
- `packages/analyzer/test/expressions.test.ts` "the text of a regular expression Angular respells"
  reports `.source`, `String()`, a template, a `+` and `.toString()`, and accepts `.test()`,
  `replace` and `split`; `packages/ir/test/portability.test.ts` pins `angularRespellsRegex`.
  `packages/codegen/test/markup-escape.test.ts` "keeps a number apart from a `.` after it and a
  `?` before it", and the kit's source "number literals before a member access, and a leading-dot
  number after `?`" renders on all seven targets.
- Svelte 5.57.1 compiles `{items.sort((a, b) => a - b).join(", ")}` into a template effect, and
  with a `$state` props proxy the sort throws `state_unsafe_mutation`.
- Node 24 formats `(1234.5).toLocaleString()` as `1,234.5` under `en_US` and `1.234,5` under
  `de_DE`; Chromium uses its own locale.
- oxc-codegen 0.152 prints `x(1000, 0x10, 0.50, 1_000)` as `x(1e3, 16, .5, 1e3)` and drops
  comments. `packages/target-react/test/emit.test.ts` "prints expressions as the source writes
  them" pins what survives oxfmt.
- Vue 3.5.43 renders `{{ "&amp;" }}` as `&`; the markup case "string literals with delimiters,
  references and markup in code" renders through Vue.
- `packages/codegen/test/render-parity-reference.test.ts` "refuses %s" covers every run-time value
  outside the contract.
- `jsx/expressions` and `jsx/escaping` are green at every live layer on all seven targets.
