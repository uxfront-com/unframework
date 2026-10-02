# @unframework/parser

Reads Unframework sources (plan §5.1, P1):

- `parseModule(file, source)` parses a `.uf.tsx` or `.uf.ts` module with oxc into a TS-ESTree AST
  with UTF-16 spans. It never throws; syntax errors are returned, with the module's early errors
  that oxc does not report (a name declared or exported twice, an export of an undeclared name).
- `findComponents(program)` finds the component candidates: top-level PascalCase function
  declarations, with how each is exported.
- `parseStylesheet(file, source)` parses a stylesheet with lightningcss and returns its syntax
  error, if any, at its exact offset.

Nothing here imports TypeScript's API.
