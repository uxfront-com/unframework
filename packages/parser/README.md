# @unframework/parser

Reads Unframework sources (plan §5.1, P1):

- `parseModule(file, source)` parses a `.uf.tsx` or `.uf.ts` module with oxc into a TS-ESTree AST
  with UTF-16 spans. Every node carries `range` too, which the analyser's scope analysis
  (`@typescript-eslint/scope-manager`, ADR-0035) needs. It never throws; syntax errors are
  returned, with the module's early errors that oxc does not report (a name declared or exported
  twice, an export of an undeclared name).
- `findComponents(program)` finds the component candidates: top-level PascalCase function
  declarations, with how each is exported.
- `findTypeDeclarations(program)` finds the top-level `interface` and `type` declarations, plain
  or exported, that props types are written with (ADR-0034).
- `visitorKeys` is oxc's child keys for every node type, so a pass can walk the AST without
  importing oxc.
- `parseStylesheet(file, source)` parses a stylesheet with lightningcss and returns its syntax
  error, if any, at its exact offset.
- `parseDeclarations(source)` reads a `style` attribute's declaration list as written (ADR-0038):
  each property and value with their spans, split at the `;` and `:` outside strings, comments and
  brackets, and lightningcss's syntax errors.

Nothing here imports TypeScript's API.
