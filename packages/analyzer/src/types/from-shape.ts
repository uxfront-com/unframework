// The value kinds of a type the type oracle resolved (ADR-0067): what a prop declared in
// another file, or built by `extends`, an intersection or a utility type, can hold. The same
// model as `from-type.ts`, read from the shape's nodes instead of the module's syntax.

import type { Span } from "@unframework/ir";
import type { ShapeMember, TypeNode, TypeShape } from "@unframework/type-oracle";

import {
  arrayOf,
  booleanLiteral,
  FUNCTION,
  kinds,
  NOTHING,
  numberLiteral,
  objectOf,
  stringLiteral,
  union,
  UNDEFINED,
  UNKNOWN,
} from "./kinds.ts";
import type { Kinds, Member } from "./kinds.ts";

/**
 * The kinds of the shape's node `id`, its root by default; objects read their members lazily.
 * `keyOf` gives where each member's key is written in the module being analysed, since a spread
 * of the member's object points its keys there, and a member may be written in another file.
 */
export function kindsFromShape(
  shape: TypeShape,
  keyOf: (member: ShapeMember) => Span,
  id: number = shape.root,
): Kinds {
  const memo = new Map<number, Kinds>();
  const read = (at: number): Kinds => {
    const cached = memo.get(at);
    if (cached) return cached;
    const value = kindsOf(shape.nodes[at]!, read, keyOf);
    memo.set(at, value);
    return value;
  };
  return read(id);
}

function kindsOf(
  node: TypeNode,
  read: (id: number) => Kinds,
  keyOf: (member: ShapeMember) => Span,
): Kinds {
  switch (node.kind) {
    case "primitive":
      switch (node.name) {
        case "any":
        case "unknown":
          return UNKNOWN;
        case "void":
          return UNDEFINED;
        case "never":
          return NOTHING;
        default:
          return kinds(node.name);
      }
    case "literal":
      return typeof node.value === "string"
        ? stringLiteral(node.value)
        : typeof node.value === "number"
          ? numberLiteral(node.value)
          : booleanLiteral(node.value);
    case "union":
      return union(...node.types.map(read));
    case "array":
      return arrayOf(() => read(node.element));
    case "tuple":
      return arrayOf(() => union(...node.elements.map((element) => read(element.type))));
    case "object":
      return objectOf({
        declared: true,
        members: () =>
          new Map(
            node.members.map((member): [string, Member] => [
              member.name,
              {
                kinds: () => read(member.type),
                optional: member.optional,
                key: keyOf(member),
              },
            ]),
          ),
      });
    case "function":
      return FUNCTION;
    default:
      // A type parameter, or a type kept as written.
      return UNKNOWN;
  }
}
