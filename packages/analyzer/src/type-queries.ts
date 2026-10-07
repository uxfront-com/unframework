// Type queries in a component's code (ADR-0045): the outputs copy type annotations as written,
// and `typeof x` names a value, whose spelling each target changes (`count()`, `this.count`,
// `countRef.current`, `props.label`). A query of a prop, of the props parameter, of a list's
// variable, of a binding the setup declares or of the authoring API, whose import the compiler
// erases, cannot be copied (P2): it is UF1002, at the query. A query of a name local to a
// function's body, of another import or of a global names the same value in every output, and
// stays.

import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import type { RenderContext } from "./render.ts";

/** Reports each type query in a component's setup and client code that names a component's value. */
export function checkTypeQueries(render: RenderContext): void {
  const { component, reporter, source } = render;
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (typed.type === "TSTypeQuery") {
      const root = entityRoot(typed.exprName);
      const what = root ? componentValue(root, render) : undefined;
      if (what) {
        const text = source.slice(typed.start, typed.end);
        reporter.unsupported(
          typed,
          `\`${text}\` queries the type of ${what}: a copied type query would name what the output does not declare, so the type is written itself.`,
          {
            help: "Write the type itself, or declare a type at the module's top level and use it in both places.",
          },
        );
      }
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  // The props' own annotation is the props' to check.
  visit([component.params.slice(1), component.body]);
}

/** The identifier a query's entity name starts with: `mode` in `typeof mode.value`. */
function entityRoot(name: AST.TSTypeQuery["exprName"]): AST.IdentifierReference | undefined {
  let current: unknown = name;
  while ((current as AST.Node).type === "TSQualifiedName") {
    current = (current as AST.TSQualifiedName).left;
  }
  return (current as AST.Node).type === "Identifier"
    ? (current as AST.IdentifierReference)
    : undefined;
}

/**
 * What a query's root names among the component's values, and why no output declares it as
 * written, or `undefined` for anything else.
 */
function componentValue(
  identifier: AST.IdentifierReference,
  render: RenderContext,
): string | undefined {
  const resolution = render.scopes.resolve(identifier);
  const { name } = identifier;
  const respelled =
    "which each output spells its own way (a call, a member of Angular's class, a React ref)";
  if (resolution.kind === "parameter") {
    if (render.propsObject?.declaration === resolution.declaration) {
      return `the props parameter \`${name}\`, ${respelled}`;
    }
    if (render.propsByDeclaration.has(resolution.declaration)) {
      return `the prop \`${name}\`, ${respelled}`;
    }
    if (render.loopVariables.has(resolution.declaration)) {
      return `the list variable \`${name}\`, ${respelled}`;
    }
    return undefined;
  }
  if (resolution.kind === "variable" && resolution.scope === render.component) {
    return `the setup's binding \`${name}\`, ${respelled}`;
  }
  // The compiler erases the authoring API's import (ADR-0006): no output declares `ref`.
  if (resolution.kind === "import" && render.setup.authoring.has(resolution.declaration)) {
    return `the authoring API \`${name}\`, whose import the compiler erases`;
  }
  return undefined;
}
