// The module's scopes (plan §5.4, ADR-0035): `@typescript-eslint/scope-manager`, pinned exactly
// because it shapes the IR (P8), run over oxc's AST, whose nodes carry the `range` it reads.
// `lib: []` registers no globals, so a name nothing declares stays unresolved, and the
// analyser decides which globals each context may read (`ALLOWED_GLOBALS`, `PURE_GLOBALS`,
// `CLIENT_GLOBALS`); `jsxPragma: null` keeps JSX from reading an implicit `React`.

import { analyze } from "@typescript-eslint/scope-manager";
import type { AST } from "@unframework/parser";

/** What an identifier in an expression refers to, by the declaration that binds it. */
export type Resolution =
  /** Nothing in the module declares it: a global, or a typo. */
  | { kind: "global" }
  /** A parameter of a function: the component's props, a list's item, a function's parameter. */
  | { kind: "parameter"; function: object; declaration: object }
  /**
   * A `const`, `let`, `var`, `function`, `class` or `catch` name, with the node of the scope that
   * declares it (ADR-0045): the component's function for the setup's bindings, the program for
   * the module's, and anything else for a name local to the code that declares it.
   */
  | {
      kind: "variable";
      declaration: object;
      scope: object;
      /** What declares it: a function's or a class's name, or any other variable. */
      declares: "variable" | "function" | "class";
    }
  /** An import: the authoring API's, recognised by binding (ADR-0006), or another module's. */
  | { kind: "import"; declaration: object }
  /** Anything else the module declares: a type, `arguments`. */
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
    case "CatchClause":
    case "FunctionName":
    case "ClassName":
      return {
        kind: "variable",
        declaration: definition.name,
        scope: variable.scope.block,
        declares:
          definition.type === "FunctionName"
            ? "function"
            : definition.type === "ClassName"
              ? "class"
              : "variable",
      };
    case "ImportBinding":
      return { kind: "import", declaration: definition.name };
    default:
      return { kind: "other" };
  }
}
