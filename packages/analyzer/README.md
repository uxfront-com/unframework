# @unframework/analyzer

Passes P2 (analyse) and P3 (lower) of the Unframework compiler (plan §5.1):

- `analyze(parsed)` checks a parsed `.uf.tsx` module and lowers each component's returned JSX into
  the portable IR. It reports every construct it cannot lower as a diagnostic, and never copies
  code through unanalysed (P2). It never throws. A syntax error stops it. Any other module-level
  error (an import, a top-level declaration) drops every component, which are still checked, so
  that fixing it reveals nothing new; an error in a component drops that component only.
- JSX text means what every JSX implementation agrees it means. Babel (Vue's and Solid's JSX)
  decodes character references and then trims lines; TypeScript, oxc (the React target's JSX)
  and esbuild trim the raw lines first, also trimming Unicode whitespace, and split them at U+2028
  and U+2029. `readJsxText` and `readJsxAttribute` read text and attribute strings by Babel's
  rules and find every place the others disagree, which the analyser reports (UF3009) instead
  of choosing one, with a fix that keeps Babel's reading wherever applying every fix of the text
  reveals nothing new; `decodeJsx` decodes references. The tests check this against Babel, oxc
  and esbuild themselves. JSX decodes only XHTML's named references: a name only HTML decodes
  (`&check;`) renders as written on every target, which is a warning (UF3011).
- Markup is HTML, or SVG inside an `<svg>` (ADR-0040), checked against the vocabulary in
  `@unframework/ir`'s `html.ts` and `svg.ts`: element names (UF3001, UF3002, tested against Vue's
  and Angular's lists, and SVG's against parse5's case adjustments), the nesting the browser's
  parser repairs (UF3003, tested against parse5, Svelte and Vue, and seen through conditionals,
  lists and fragments), attribute names and values (UF3004 to UF3008, ARIA's value types and roles
  included), and characters HTML would not keep (UF3010). Whatever the targets would render
  differently is a diagnostic; a non-canonical form has a fix. The IR it lowers keeps
  `checkInvariants` of `@unframework/ir`, which its tests check on every module.

## The M1 subset

Exported components with typed props and static JSX (plan §9 M1, ADR-0034 to ADR-0040). A
component is a function declaration; one written as a value (`export const Card = (props) => …`)
is UF1102, checked as the declaration its likely fix writes (`analyze.ts`).

- **Props** (`props.ts`, `declarations.ts`): the one parameter, destructured with static defaults
  or kept as one object read as `props.x`, typed by an object type literal or a local `interface`
  or `type`. Member types keep to what every target's props can declare. Problems are UF2001 to
  UF2003, and UF1002 for types that land in M5. Each top-level type declaration must be reached by
  some component's props; the outputs copy it as written.
- **Expressions** (`expressions.ts`): a subset of JavaScript every target reads alike, Angular's
  template language included, checked in one walk that resolves every name with
  `@typescript-eslint/scope-manager` (`scope.ts`) and records it in `Expression.refs`. Names are
  props, list variables, expression-local arrow parameters and the allowed globals; anything else
  is UF3020, UF3019 (time, chance, locale) or UF1002 (setup code, M2). Impure expressions are
  UF3021, `??` and `?.` on a value that is never nullish UF3023, a parameter that shadows a
  rewritten name, takes an Angular keyword or is never read UF3024 (a part the walk reports
  without reading counts as reading every parameter it names). A small syntactic model of value
  kinds (`types/`) feeds the checks that depend on what a value can be, narrowed where a
  reference is read by the tests around it (truthiness, `typeof`, `Array.isArray`, a literal, a
  discriminant) as TypeScript narrows its type, where every target keeps the narrowing
  (`narrowing.ts`).
- **Children** (`lower.ts`, `lists.ts`): text, expressions rendered as text (UF3016), conditionals
  (`c && X`, `?:` chains holding JSX; UF3025 for `||` and `??` with JSX, fixed as `x ? x : …` and
  `x != null ? x : …` where `x` is a reference that renders as text) and keyed lists
  (`source.map((item, index) => <el key={…}>`; UF3013 to UF3015, UF3018 for the source and the
  key; `source?.map(…)` is a list whose `?.` is UF3023, or UF3018 with the fix
  `(source ?? []).map(…)`). Texts side by side are one text, whatever drops or flattens between
  them. A line feed that can start a `<pre>`, through conditionals and past what can render
  nothing, is UF3017; text in an `<iframe>`, which the parser reads as raw text, is UF3003.
- **Attributes** (`attribute-names.ts`, `attributes.ts`, `enumerated.ts`, `class.ts`, `style.ts`,
  `aria.ts`): name checks first, whatever the value; then static values, literals in braces
  (written statically, UF3004), bindings whose kinds must fit the attribute and whose values
  every typed target's element types accept (UF3018: an enumerated attribute's tokens, a
  string where a target types one), `class` parts, `style` declarations (parsed by
  `@unframework/parser`, UF3022 for what the targets cannot keep apart) and spreads of objects
  whose keys a local type declares. A spread records whether its object may be nullish where
  it renders (`spread-source.ts`): its kinds say whether its type may be, and the conditions
  around it narrow it as every target's checker does; a test the compiler does not follow is
  UF1002, and a source the conditions show is absent UF3004. A bound `value` that may be nullish
  on the elements whose `value` some targets set as a property (`NULLISH_VALUE_ELEMENTS`) is
  UF1002.

Every fix leaves exactly the diagnostics that had none once all are applied (the harness's L1),
which the tests check for each fix, for each pair that can meet, and over random mixes.

## Tests

`pnpm --filter @unframework/analyzer test`. Besides the rules' own tests, the conformance tests run
the tools the rules stand for: parse5 (the HTML parser's repairs and SVG adjustments), Svelte, Vue
and Angular (element and attribute tables, ARIA warnings, Angular's security schema), Babel, oxc
and esbuild (JSX text), and Angular's template parser over a seeded fuzz of every accepted
expression form. `types-conformance.test.ts` runs `tsc` (the executable, never the API) over
probes of every attribute of every element against Vue's, React's, Solid's, Qwik's, Svelte's and
Astro's element types, resolved from the target packages, under the names each target prints:
what the analyser accepts in a binding, every target's types accept, and every name it accepts,
the authoring types, React's and Vue's declare. The IR holds the tables both read
(`UNDECLARED_ATTRIBUTES`, `UNBINDABLE_ATTRIBUTES`, `RESERVED_TYPE_NAMES`, `CSS_PROPERTIES`), so
`checkInvariants` rejects the same.
