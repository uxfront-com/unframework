// `isDev` (ADR-0117): code that runs only in a development build. It is read in one form, the
// whole test of an `if` with no `else`, at the top level of the setup or in client code, where
// each target writes its framework's own check in its place. Any other read is UF2040.

import type { AST } from "@unframework.dev/parser";

import type { AuthoringApi } from "./authoring.ts";
import type { Reporter } from "./context.ts";
import type { Scopes } from "./scope.ts";

/** What resolves a name to its declaration, and the authoring API an import declares. */
interface DevScope {
  readonly scopes: Scopes;
  readonly authoring: ReadonlyMap<object, AuthoringApi | undefined>;
}

/** Whether an identifier is `isDev`, by the binding its import declares (ADR-0006). */
export function isDevIdentifier(node: AST.IdentifierReference, scope: DevScope): boolean {
  const resolution = scope.scopes.resolve(node);
  return resolution.kind === "import" && scope.authoring.get(resolution.declaration) === "isDev";
}

/** The `isDev` test of an `if` with no `else`, in its one form: `if (isDev) { … }`. */
export function devTest(
  node: AST.IfStatement,
  scope: DevScope,
): AST.IdentifierReference | undefined {
  const { test } = node;
  if (node.alternate || test.type !== "Identifier") return undefined;
  return isDevIdentifier(test, scope) ? test : undefined;
}

/** `isDev` read anywhere but as the test of an `if` with no `else` where code may test it. */
export function misplacedDev(
  node: AST.IdentifierReference,
  reporter: Reporter,
  why?: string,
): void {
  reporter.report(
    "UF2040",
    node,
    why ??
      `\`${node.name}\` is read only as the whole test of an \`if\` with no \`else\`: each target writes its framework's own development check in its place, which a production build drops with its block.`,
    { help: `Write \`if (${node.name}) { … }\` at the top of the setup or in client code.` },
  );
}
