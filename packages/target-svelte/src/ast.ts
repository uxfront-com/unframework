// Walking oxc's AST of code the target parses (setup code, a function's body): nodes as far as
// the target reads them.

/** A node of oxc's AST. */
export type AstNode = { type: string; start: number; end: number } & Record<string, unknown>;

/** Calls `fn` on every node of a parsed tree, parents first. */
export function visit(root: unknown, fn: (node: AstNode) => void): void {
  if (Array.isArray(root)) {
    for (const item of root) visit(item, fn);
    return;
  }
  if (typeof root !== "object" || root === null) return;
  const node = root as Partial<AstNode>;
  if (typeof node.type === "string" && typeof node.start === "number") fn(node as AstNode);
  for (const value of Object.values(node)) if (typeof value === "object") visit(value, fn);
}

/** The ranges of the functions inside a parsed tree. */
export function functionRanges(root: unknown): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  visit(root, (node) => {
    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression" ||
      node.type === "FunctionDeclaration"
    ) {
      ranges.push({ start: node.start, end: node.end });
    }
  });
  return ranges;
}

/**
 * Whether a parsed tree reads a variable `name`: an identifier other than a member's or a
 * property's name (`a.name`, `{ name: 1 }`; a shorthand `{ name }` reads it).
 */
export function readsName(root: unknown, name: string): boolean {
  let found = false;
  const walk = (node: unknown, parent: AstNode | undefined, key: string | undefined): void => {
    if (found) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, parent, key);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const current = node as Partial<AstNode>;
    if (current.type === "Identifier" && current["name"] === name) {
      const memberName =
        parent?.type === "MemberExpression" && key === "property" && parent["computed"] !== true;
      const propertyKey =
        parent?.type === "Property" &&
        key === "key" &&
        parent["computed"] !== true &&
        parent["shorthand"] !== true;
      if (!memberName && !propertyKey) found = true;
      return;
    }
    const isNode = typeof current.type === "string";
    for (const [childKey, value] of Object.entries(current)) {
      if (typeof value === "object") {
        walk(value, isNode ? (current as AstNode) : parent, isNode ? childKey : key);
      }
    }
  };
  walk(root, undefined, undefined);
  return found;
}
