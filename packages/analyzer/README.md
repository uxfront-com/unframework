# @unframework/analyzer

Passes P2 (analyse) and P3 (lower) of the Unframework compiler (plan §5.1):

- `analyze(parsed)` checks a parsed `.uf.tsx` module and lowers each component's returned JSX into
  the portable IR. It reports every construct it cannot lower as a diagnostic, and never copies
  code through unanalysed (P2).
- JSX text means what every JSX implementation agrees it means. Babel (Vue's and Solid's JSX)
  decodes character references and then trims lines; TypeScript, oxc (the React target's JSX)
  and esbuild trim the raw lines first, also trimming Unicode whitespace, and split them at U+2028
  and U+2029. `readJsxText` and `readJsxAttribute` read text and attribute strings by Babel's
  rules and find every place the others disagree, which the analyser reports (UF3009) instead
  of choosing one, with a fix that keeps Babel's reading wherever applying every fix of the text
  reveals nothing new; `decodeJsx` decodes references. The tests check this against Babel, oxc
  and esbuild themselves. JSX decodes only XHTML's named references: a name only HTML decodes
  (`&check;`) renders as written on every target, which is a warning (UF3011).
- Markup is HTML, checked against the vocabulary in `@unframework/ir`'s `html.ts`: element names
  (UF3001, UF3002, tested against Vue's and Angular's lists), the nesting the browser's parser
  repairs (UF3003, tested against parse5, Svelte and Vue), attribute names and values (UF3004 to
  UF3008), and characters HTML would not keep (UF3010, wherever they are: the readings take such
  a character for a character, so it is never UF3009). Whatever the targets would render
  differently is a diagnostic; a non-canonical form has a fix. A static `class` is lowered with
  one space between its names, as Vue, Svelte and Angular render it. The IR it lowers keeps
  `checkInvariants` of `@unframework/ir`, which its tests check on every module.

The milestone-0 subset is exported components without props or setup code that return static
elements, text and attributes. A local function that returns JSX is a helper, not a component
(UF3012): JSX lives only in a component's template.
