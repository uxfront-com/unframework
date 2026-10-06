// Value kinds from TypeScript types (design §1.6): a prop's kinds are its member type's,
// followed through the module's own `interface` and `type` declarations. Only the types the
// props check accepts (§1.1) need a faithful reading; anything else reads as `unknown`.

import type { AST, TypeDeclarationStatement } from "@unframework/parser";

import {
  arrayOf,
  BOOLEAN,
  booleanLiteral,
  FUNCTION,
  kinds,
  NULL,
  NUMBER,
  numberLiteral,
  objectOf,
  STRING,
  stringLiteral,
  UNDEFINED,
  union,
  UNKNOWN,
} from "./kinds.ts";
import type { Kinds, Member, ObjectShape } from "./kinds.ts";

/** A member key's name: an identifier, or a string literal (`"aria-label": string`). */
export function memberName(key: AST.PropertyKey): string | undefined {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

/** The module's type declarations, and the kinds of the types that use them. */
export class TypeTable {
  readonly #declarations = new Map<string, TypeDeclarationStatement>();
  readonly #memo = new Map<object, Kinds>();
  readonly #resolving = new Set<object>();

  constructor(declarations: readonly TypeDeclarationStatement[]) {
    // The first declaration of a name is the one checks read: a second is reported (UF1002).
    for (const declaration of declarations) {
      if (!this.#declarations.has(declaration.name)) {
        this.#declarations.set(declaration.name, declaration);
      }
    }
  }

  /** The local declaration of a name, if the module declares one. */
  declaration(name: string): TypeDeclarationStatement | undefined {
    return this.#declarations.get(name);
  }

  /** The kinds of a value of a type. */
  kindsOf(type: AST.TSType): Kinds {
    const cached = this.#memo.get(type);
    if (cached) return cached;
    if (this.#resolving.has(type)) return UNKNOWN;
    this.#resolving.add(type);
    const result = this.#read(type);
    this.#resolving.delete(type);
    this.#memo.set(type, result);
    return result;
  }

  /** The shape of an interface's or an object type literal's members. */
  shapeOf(members: readonly AST.TSSignature[]): ObjectShape {
    let read: ReadonlyMap<string, Member> | undefined;
    return {
      declared: true,
      members: () => {
        read ??= new Map(
          members.flatMap((member): [string, Member][] => {
            if (member.type !== "TSPropertySignature" || member.computed) return [];
            const name = memberName(member.key);
            const type = member.typeAnnotation?.typeAnnotation;
            if (name === undefined) return [];
            return [
              [
                name,
                {
                  kinds: () => (type ? this.kindsOf(type) : UNKNOWN),
                  optional: member.optional,
                  key: { start: member.key.start, end: member.key.end },
                },
              ],
            ];
          }),
        );
        return read;
      },
    };
  }

  #read(type: AST.TSType): Kinds {
    switch (type.type) {
      case "TSStringKeyword":
        return STRING;
      case "TSNumberKeyword":
        return NUMBER;
      case "TSBooleanKeyword":
        return BOOLEAN;
      case "TSNullKeyword":
        return NULL;
      case "TSUndefinedKeyword":
      case "TSVoidKeyword":
        return UNDEFINED;
      case "TSBigIntKeyword":
        return kinds("bigint");
      case "TSSymbolKeyword":
        return kinds("symbol");
      case "TSObjectKeyword":
        return kinds("object");
      case "TSNeverKeyword":
        return kinds();
      case "TSLiteralType":
        return literalKinds(type.literal);
      case "TSUnionType":
        return union(...type.types.map((member) => this.kindsOf(member)));
      case "TSArrayType":
        return arrayOf(() => this.kindsOf(type.elementType));
      case "TSTupleType":
        return arrayOf(() =>
          union(
            ...type.elementTypes.map((element) =>
              "type" in element && element.type.startsWith("TS")
                ? this.kindsOf(element as AST.TSType)
                : UNKNOWN,
            ),
          ),
        );
      case "TSTypeOperator":
        return type.operator === "readonly" ? this.kindsOf(type.typeAnnotation) : UNKNOWN;
      case "TSParenthesizedType":
        return this.kindsOf(type.typeAnnotation);
      case "TSFunctionType":
      case "TSConstructorType":
        return FUNCTION;
      case "TSTypeLiteral":
        return objectOf(this.shapeOf(type.members));
      case "TSTypeReference":
        return this.#reference(type);
      default:
        return UNKNOWN;
    }
  }

  #reference(type: AST.TSTypeReference): Kinds {
    if (type.typeName.type !== "Identifier") return UNKNOWN;
    const { name } = type.typeName;
    const argument = type.typeArguments?.params[0];
    if ((name === "Array" || name === "ReadonlyArray") && argument) {
      return arrayOf(() => this.kindsOf(argument));
    }
    const declaration = type.typeArguments ? undefined : this.#declarations.get(name);
    if (!declaration) return UNKNOWN;
    const { node } = declaration;
    if (node.type === "TSInterfaceDeclaration") {
      const cached = this.#memo.get(node);
      if (cached) return cached;
      const shape = objectOf(this.shapeOf(node.body.body));
      this.#memo.set(node, shape);
      return shape;
    }
    return this.kindsOf(node.typeAnnotation);
  }
}

/** The kinds of a literal type: `"sm"`, `-1`, `true`, or a template literal without holes. */
function literalKinds(literal: AST.TSLiteral): Kinds {
  switch (literal.type) {
    case "Literal":
      if (typeof literal.value === "string") return stringLiteral(literal.value);
      if (typeof literal.value === "number") return numberLiteral(literal.value);
      if (typeof literal.value === "boolean") return booleanLiteral(literal.value);
      return kinds("bigint");
    case "UnaryExpression":
      return literal.argument.type === "Literal" && typeof literal.argument.value === "number"
        ? numberLiteral(literal.operator === "-" ? -literal.argument.value : literal.argument.value)
        : NUMBER;
    case "TemplateLiteral":
      return literal.expressions.length
        ? STRING
        : stringLiteral(literal.quasis.map((quasi) => quasi.value.cooked ?? "").join(""));
    default:
      return UNKNOWN;
  }
}
