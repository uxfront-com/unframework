// The module's scopes (plan §5.4, ADR-0035): `@typescript-eslint/scope-manager`, pinned exactly
// because it shapes the IR (P8), run over oxc's AST, whose nodes carry the `range` it reads.
// `lib: []` registers no globals, so a name nothing declares stays unresolved, and the
// analyser decides which globals an expression may read (`ALLOWED_GLOBALS`); `jsxPragma: null`
// keeps JSX from reading an implicit `React`.

import { analyze } from "@typescript-eslint/scope-manager";
import type { AST } from "@unframework/parser";

/** What an identifier in an expression refers to, by the declaration that binds it. */
export type Resolution =
  /** Nothing in the module declares it: a global, or a typo. */
  | { kind: "global" }
  /** A parameter of a function: the component's props, a list's item, an arrow's parameter. */
  | { kind: "parameter"; function: object; declaration: object }
  /** A variable or an import: setup code, which lands in M2. */
  | { kind: "setup"; declaration: object }
  /** Anything else the module declares: a function, a class, a type, `arguments`. */
  | { kind: "other" };

/** The scopes of a module, and what each identifier in it refers to. */
export class Scopes {
  /** Each reference, by its identifier node. */
  readonly #references = new Map<object, Resolution>();

  constructor(program: AST.Program) {
    const manager = analyze(program as unknown as Parameters<typeof analyze>[0], {
      sourceType: "module",
      jsxPragma: null,
      lib: [],
    });
    for (const scope of manager.scopes) {
      for (const reference of scope.references) {
        this.#references.set(reference.identifier, resolutionOf(reference.resolved));
      }
    }
  }

  /** What an identifier refers to. One scope analysis never visited reads as a global. */
  resolve(identifier: AST.IdentifierReference): Resolution {
    return this.#references.get(identifier) ?? { kind: "global" };
  }
}

type Variable = ReturnType<typeof analyze>["variables"][number];

function resolutionOf(variable: Variable | null): Resolution {
  if (!variable) return { kind: "global" };
  const [definition] = variable.defs;
  if (!definition) return { kind: "other" };
  switch (definition.type as string) {
    case "Parameter":
      return { kind: "parameter", function: definition.node, declaration: definition.name };
    case "Variable":
    case "ImportBinding":
      return { kind: "setup", declaration: definition.name };
    default:
      return { kind: "other" };
  }
}
