// The value kinds of a type the type oracle resolved (ADR-0067): what a prop can hold, whether
// its module declares its type or another file does, and whether it is built by `extends`, an
// intersection or a utility type. The same model as `from-type.ts`, read from the shape's nodes
// instead of the module's syntax.

import type { Span } from "@unframework/ir";
import type { DeclarationRef, ShapeMember, TypeNode, TypeShape } from "@unframework/type-oracle";

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

/** How the kinds of a shape's nodes read what the shape alone does not say. */
export interface ShapeReading {
  /**
   * Where each member's key is written in the module being analysed, since a spread of the
   * member's object points its keys there, and a member may be written in another file.
   */
  keyOf(member: ShapeMember): Span;
  /**
   * Whether an `interface` declares an object, which then has no implicit index signature
   * (ADR-0065): the shape names the declaration, not its kind.
   */
  isInterface(declaration: DeclarationRef): boolean;
}

/**
 * The kinds of the shape's node `id`, its root by default; objects read their members lazily.
 */
export function kindsFromShape(
  shape: TypeShape,
  reading: ShapeReading,
  id: number = shape.root,
): Kinds {
  const memo = new Map<number, Kinds>();
  const read = (at: number): Kinds => {
    const cached = memo.get(at);
    if (cached) return cached;
    const value = kindsOf(shape.nodes[at]!, read, reading);
    memo.set(at, value);
    return value;
  };
  return read(id);
}

function kindsOf(node: TypeNode, read: (id: number) => Kinds, reading: ShapeReading): Kinds {
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
        ...(node.declaration && reading.isInterface(node.declaration)
          ? { interface: true as const }
          : {}),
        members: () =>
          new Map(
            node.members.map((member): [string, Member] => [
              member.name,
              {
                kinds: () => read(member.type),
                optional: member.optional,
                key: reading.keyOf(member),
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
