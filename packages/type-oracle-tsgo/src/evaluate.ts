// What the checker adds to a syntactic shape (plan §5.5, ADR-0067): each opaque node the
// syntactic adapter left `unsupported` (a conditional, a mapped type, `keyof`, `typeof`, a
// template literal with holes) is evaluated by tsgo, and replaced when its result is a type a
// `TypeShape` can hold. Anything else keeps its opaque node and its `unresolved` entry, never a
// wrong node.

import type {
  DeclarationRef,
  OpaqueNode,
  PrimitiveNode,
  ShapeMember,
  Span,
  TypeNode as ShapeNode,
  TypeParameterNode,
  TypeShape,
} from "@unframework/type-oracle";
import { ModifierFlags, SyntaxKind } from "typescript/unstable/ast";
import type { Node } from "typescript/unstable/ast";
import {
  isExpressionWithTypeArguments,
  isIdentifier,
  isImportTypeNode,
  isInterfaceDeclaration,
  isLiteralTypeNode,
  isMethodSignatureDeclaration,
  isParameterDeclaration,
  isPropertyDeclaration,
  isPropertySignatureDeclaration,
  isQualifiedName,
  isTypeQueryNode,
  isTypeAliasDeclaration,
  isTypeReferenceNode,
} from "typescript/unstable/ast/is";
import {
  ElementFlags,
  NodeBuilderFlags,
  ObjectFlags,
  SignatureKind,
  SymbolFlags,
  TypeFlags,
} from "typescript/unstable/sync";
import type { Checker, Signature, Symbol, Type, TypeReference } from "typescript/unstable/sync";

export interface EvaluateContext {
  checker: Checker;
  /** The file of a source file as a shape names it, or `undefined` outside the root (a lib). */
  fileOf(fileName: string): string | undefined;
  /** The query's own file, which `dependencies` leaves out. */
  file: string;
  /** The type node at a span of a file, named as a shape names it. */
  nodeAt(file: string, span: Span): Node | undefined;
}

/** The checker's `CheckFlags`, which `typescript/unstable/sync` does not export. */
const CHECK_SYNTHETIC = 1 << 1;
const CHECK_READONLY = 1 << 3;
const CHECK_MAPPED = 1 << 18;

/**
 * How deep a conversion nests before it gives up: a type that takes new arguments inside itself
 * (`type Wrap<T> = { inner: Wrap<[T]> }`) is a new type at each level and never ends, as the
 * syntactic adapter's ten levels of instantiation never end (plan §5.5).
 */
const MAX_DEPTH = 50;

const PRIMITIVES: readonly [TypeFlags, PrimitiveNode["name"]][] = [
  [TypeFlags.Any, "any"],
  [TypeFlags.Unknown, "unknown"],
  [TypeFlags.String, "string"],
  [TypeFlags.Number, "number"],
  [TypeFlags.Boolean, "boolean"],
  [TypeFlags.BigInt, "bigint"],
  [TypeFlags.ESSymbol, "symbol"],
  [TypeFlags.NonPrimitive, "object"],
  [TypeFlags.Null, "null"],
  [TypeFlags.Undefined, "undefined"],
  [TypeFlags.Void, "void"],
  [TypeFlags.Never, "never"],
];

/** Thrown inside a conversion that meets a type a shape cannot hold; the conversion is undone. */
class Unrepresentable extends Error {}

const keyOf = (node: { file: string; span: Span }) =>
  `${node.file}:${node.span.start}:${node.span.end}`;

/**
 * Evaluates the opaque nodes of `shape` that the syntactic adapter could not, with `type`, the
 * checker's type of the queried node. Each one is reached from the root along the members,
 * elements, parameters and returns both sides share; a node reached only through a union stays
 * opaque, since its counterpart among the union's parts is not sure.
 */
export function evaluate(shape: TypeShape, queried: Type, context: EvaluateContext): TypeShape {
  const { checker } = context;
  const nodes: ShapeNode[] = structuredClone(shape.nodes);
  const open = new Set(
    shape.unresolved.filter((entry) => entry.reason === "unsupported").map(keyOf),
  );
  const dependencies = new Set(shape.dependencies);
  const replaced = new Set<string>();
  const converter = createConverter(nodes, dependencies, context);
  const seen = new Set<number>();

  const visit = (id: number, type: Type, optional: boolean): number => {
    const node = nodes[id]!;
    if (node.kind === "opaque") {
      if (!open.has(keyOf(node))) return id;
      // Its text is read first: a construct that names something missing stays opaque.
      const written = context.nodeAt(node.file, node.span);
      const files = written && converter.read(written);
      if (!files) return id;
      const converted = converter.convert(type, optional, node);
      if (converted === undefined) return id;
      for (const file of files) converter.depend(file);
      replaced.add(keyOf(node));
      return converted;
    }
    const each = parts(type, optional);
    const sole = each.length === 1 ? each[0] : undefined;
    if (!sole || seen.has(id)) return id;
    seen.add(id);
    switch (node.kind) {
      case "object":
        for (const member of node.members) {
          const property = checker.getPropertyOfType(sole, member.name);
          const memberType = property && checker.getTypeOfSymbol(property);
          if (memberType) member.type = visit(member.type, memberType, member.optional);
        }
        break;
      case "array": {
        const [element] =
          sole.isTypeReference() && checker.isArrayType(sole) ? checker.getTypeArguments(sole) : [];
        if (element) node.element = visit(node.element, element, false);
        break;
      }
      case "tuple": {
        const elements =
          sole.isTypeReference() && checker.isTupleType(sole) ? checker.getTypeArguments(sole) : [];
        node.elements.forEach((element, index) => {
          const elementType = elements[index];
          if (elementType && !element.rest) element.type = visit(element.type, elementType, false);
        });
        break;
      }
      case "function": {
        const signatures = checker.getSignaturesOfType(sole, SignatureKind.Call);
        if (signatures.length !== 1) break;
        const signature = signatures[0]!;
        const parameters = signature.getParameters();
        node.parameters.forEach((parameter, index) => {
          const symbol = parameters[index];
          const parameterType = symbol && checker.getTypeOfSymbol(symbol);
          if (parameterType && !parameter.rest) {
            parameter.type = visit(parameter.type, parameterType, parameter.optional);
          }
        });
        const returns = checker.getReturnTypeOfSignature(signature);
        if (returns) node.returns = visit(node.returns, returns, false);
        break;
      }
    }
    return id;
  };
  const root = visit(shape.root, queried, false);
  if (!replaced.size) return shape;

  // An entry stays while an opaque node of its span is still reachable.
  const reachable = new Set<string>();
  const walk = (id: number, done: Set<number>) => {
    if (done.has(id)) return;
    done.add(id);
    const node = nodes[id]!;
    for (const child of children(node)) walk(child, done);
    if (node.kind === "opaque") reachable.add(keyOf(node));
  };
  walk(root, new Set());
  return {
    root,
    nodes,
    construction: shape.construction,
    dependencies: [...dependencies].toSorted(),
    unresolved: shape.unresolved.filter(
      (entry) => !replaced.has(keyOf(entry)) || reachable.has(keyOf(entry)),
    ),
  };
}

/** The parts of a type, without the `undefined` an optional member or parameter adds. */
function parts(type: Type, optional: boolean): readonly Type[] {
  // `boolean` is the union of its two literals, and one type.
  if (!type.isUnionType() || type.flags & TypeFlags.Boolean) return [type];
  return type.getTypes().filter((part) => !optional || !(part.flags & TypeFlags.Undefined));
}

function children(node: ShapeNode): number[] {
  switch (node.kind) {
    case "union":
      return node.types;
    case "array":
      return [node.element];
    case "tuple":
      return node.elements.map((element) => element.type);
    case "object":
      return [...(node.typeArguments ?? []), ...node.members.map((member) => member.type)];
    case "function":
      return [...node.parameters.map((parameter) => parameter.type), node.returns];
    case "typeParameter":
      return node.constraint === undefined ? [] : [node.constraint];
    default:
      return [];
  }
}

/** Converts checker types into nodes appended to `nodes`, each type once. */
function createConverter(nodes: ShapeNode[], dependencies: Set<string>, context: EvaluateContext) {
  const { checker } = context;
  const converted = new Map<number, number>();
  const push = (node: ShapeNode) => nodes.push(node) - 1;
  let at: OpaqueNode;
  let depth = 0;

  const build = (type: Type, optional = false): number => {
    if (depth >= MAX_DEPTH) throw new Unrepresentable();
    depth++;
    try {
      return convertType(type, optional);
    } finally {
      depth--;
    }
  };

  const convertType = (type: Type, optional: boolean): number => {
    // An enum's members are not their values' literals: `"x"` is not assignable to `E`.
    if (type.isErrorType() || type.flags & TypeFlags.EnumLike) throw new Unrepresentable();
    if (!optional) {
      const known = converted.get(type.id);
      if (known !== undefined) return known;
    }
    if (type.isUnionType() && !(type.flags & TypeFlags.Boolean)) {
      const each = parts(type, optional);
      // A shape writes the union of both boolean literals as the primitive.
      const booleans = each.filter((part) => part.flags & TypeFlags.BooleanLiteral);
      const types =
        booleans.length === 2
          ? [
              ...each.filter((part) => !(part.flags & TypeFlags.BooleanLiteral)),
              checker.getBooleanType(),
            ]
          : each;
      if (types.length === 1) return build(types[0]!);
      const ids = [...new Set(types.map((part) => build(part)))];
      const id = push({ kind: "union", types: ids });
      if (!optional) converted.set(type.id, id);
      return id;
    }
    const primitive = PRIMITIVES.find(([flag]) => type.flags & flag);
    if (primitive) return push({ kind: "primitive", name: primitive[1] });
    if (type.isStringLiteralType() || type.isNumberLiteralType() || type.isBooleanLiteralType()) {
      return push({ kind: "literal", value: type.value });
    }
    if (type.isTypeParameter() && !type.isThisType) {
      const node: TypeParameterNode = { kind: "typeParameter", name: type.getSymbol()!.name };
      const id = push(node);
      converted.set(type.id, id);
      const constraint = checker.getConstraintOfTypeParameter(type);
      if (constraint) node.constraint = build(constraint);
      return id;
    }
    if (type.isTypeReference() && checker.isArrayType(type)) {
      const [element] = checker.getTypeArguments(type);
      const node = {
        kind: "array" as const,
        element: -1,
        readonly: type.getTarget().getSymbol()?.name === "ReadonlyArray",
      };
      const id = push(node);
      converted.set(type.id, id);
      node.element = build(element!);
      return id;
    }
    if (type.isTypeReference() && checker.isTupleType(type)) return tuple(type);
    if (type.isObjectType()) {
      const calls = checker.getSignaturesOfType(type, SignatureKind.Call);
      if (calls.length) {
        if (calls.length !== 1 || checker.getPropertiesOfType(type).length) {
          throw new Unrepresentable();
        }
        return signature(calls[0]!);
      }
      return object(type);
    }
    if (type.isIntersectionType()) return object(type);
    // Index, indexed-access, conditional and substitution types left generic, template literals
    // and string mappings that keep a hole, enums, unique symbols and bigint literals.
    throw new Unrepresentable();
  };

  const tuple = (type: TypeReference): number => {
    const target = type.getTarget();
    if (!target.isTupleType()) throw new Unrepresentable();
    const flags = target.elementFlags;
    if (flags.some((flag) => flag & ElementFlags.Variadic)) throw new Unrepresentable();
    const id = push({ kind: "tuple", elements: [], readonly: target.readonly });
    converted.set(type.id, id);
    const elements = checker.getTypeArguments(type).slice(0, flags.length);
    nodes[id] = {
      kind: "tuple",
      readonly: target.readonly,
      elements: elements.map((element, index) => {
        const optional = (flags[index]! & ElementFlags.Optional) !== 0;
        const rest = (flags[index]! & ElementFlags.Rest) !== 0;
        // A rest element holds its array, as the syntactic adapter writes it.
        return {
          type: rest
            ? push({ kind: "array", element: build(element), readonly: false })
            : build(element, optional),
          optional,
          rest,
        };
      }),
    };
    return id;
  };

  const signature = (call: Signature): number => {
    if (call.getTypeParameters().length) throw new Unrepresentable();
    const id = push({ kind: "function", parameters: [], returns: -1 });
    const parameters = call.getParameters().map((parameter) => {
      const node = parameter.valueDeclaration?.resolve();
      const declaration = node && isParameterDeclaration(node) ? node : undefined;
      const optional = Boolean(declaration?.questionToken || declaration?.initializer);
      const parameterType = checker.getTypeOfSymbol(parameter);
      if (!parameterType) throw new Unrepresentable();
      return {
        name: parameter.name,
        type: build(parameterType, optional),
        optional,
        rest: Boolean(declaration?.dotDotDotToken),
      };
    });
    const returns = checker.getReturnTypeOfSignature(call);
    if (!returns) throw new Unrepresentable();
    nodes[id] = { kind: "function", parameters, returns: build(returns) };
    return id;
  };

  /** Throws for an object type, or a part of an intersection, a shape cannot hold. */
  const representable = (type: Type) => {
    if (!type.isObjectType()) throw new Unrepresentable();
    const symbol = type.getSymbol();
    if (symbol && symbol.flags & (SymbolFlags.Class | SymbolFlags.Enum)) {
      throw new Unrepresentable();
    }
    // A mapped type over keys that are still generic (`keyof T`, `keyof T | "a"`) lists only
    // the keys it knows; the checker writes it, alias expanded, as a mapped type only then.
    if (
      type.objectFlags & ObjectFlags.Mapped &&
      checker.typeToTypeNode(type, undefined, NodeBuilderFlags.InTypeAlias)?.kind ===
        SyntaxKind.MappedType
    ) {
      throw new Unrepresentable();
    }
  };

  const object = (type: Type): number => {
    // An intersection's members are read only when each of its parts could be.
    for (const part of type.isIntersectionType() ? type.getTypes() : [type]) representable(part);
    if (checker.getIndexInfosOfType(type).length) throw new Unrepresentable();
    if (
      checker.getSignaturesOfType(type, SignatureKind.Construct).length ||
      checker.getSignaturesOfType(type, SignatureKind.Call).length
    ) {
      throw new Unrepresentable();
    }
    const named = type.getAliasSymbol() ?? type.getSymbol();
    const declaration = named && declarationRef(named);
    const id = push({ kind: "object", ...(declaration && { declaration }), members: [] });
    converted.set(type.id, id);
    // A reference's arguments, without the `this` argument an interface's own reference takes.
    const target = type.isTypeReference() ? type.getTarget() : undefined;
    const typeArguments = type.getAliasSymbol()
      ? type.getAliasTypeArguments()
      : type.isTypeReference() && target?.isClassOrInterface()
        ? checker.getTypeArguments(type).slice(0, target.getTypeParameters().length)
        : [];
    const members = checker.getPropertiesOfType(type).map((property) => member(property));
    nodes[id] = {
      kind: "object",
      ...(declaration && { declaration }),
      ...(typeArguments.length > 0 && { typeArguments: typeArguments.map((each) => build(each)) }),
      members,
    };
    return id;
  };

  const member = (property: Symbol): ShapeMember => {
    if (property.flags & (SymbolFlags.GetAccessor | SymbolFlags.SetAccessor)) {
      throw new Unrepresentable();
    }
    // A key that is a unique symbol has no name a shape can write.
    if (property.escapedName.startsWith("__@")) throw new Unrepresentable();
    const optional = (property.flags & SymbolFlags.Optional) !== 0;
    const propertyType = checker.getTypeOfSymbol(property);
    if (!propertyType) throw new Unrepresentable();
    const node = property.declarations[0]?.resolve();
    const written =
      node &&
      (isPropertySignatureDeclaration(node) ||
        isMethodSignatureDeclaration(node) ||
        isPropertyDeclaration(node))
        ? node
        : undefined;
    // A mapped type's member takes its modifiers (`readonly`, `-readonly`) and its type from
    // the mapping, and an intersection's from all its parts (readonly only when each part makes
    // it so): its first declaration's are not its own.
    const mapped = (property.checkFlags & (CHECK_MAPPED | CHECK_SYNTHETIC)) !== 0;
    const readonly =
      (property.checkFlags & CHECK_READONLY) !== 0 ||
      (!mapped && ((written?.modifierFlags ?? 0) & ModifierFlags.Readonly) !== 0);
    const typeNode = mapped ? undefined : written?.type;
    const type = build(propertyType, optional);
    if (!node) {
      // A member a mapped type makes has no declaration: it is written where the type is.
      return {
        name: property.name,
        optional,
        readonly,
        type,
        file: at.file,
        span: at.span,
        references: [],
      };
    }
    const source = node.getSourceFile();
    const file = context.fileOf(source.fileName);
    if (file === undefined) throw new Unrepresentable();
    depend(file);
    const owner = ownerOf(node);
    return {
      name: property.name,
      optional,
      readonly,
      type,
      file,
      ...(owner && { declaration: owner }),
      span: { start: node.getStart(source), end: node.end },
      ...(typeNode && {
        typeText: {
          code: source.text.slice(typeNode.getStart(source), typeNode.end),
          span: { start: typeNode.getStart(source), end: typeNode.end },
        },
      }),
      references: mapped
        ? []
        : references([
            ...(written && isMethodSignatureDeclaration(written) ? written.parameters : []),
            ...(typeNode ? [typeNode] : []),
          ]),
    };
  };

  /** The interface or alias a symbol's first declaration is. */
  const declarationRef = (symbol: Symbol): DeclarationRef | undefined => {
    const node = symbol.declarations[0]?.resolve();
    if (!node || !(isInterfaceDeclaration(node) || isTypeAliasDeclaration(node))) return undefined;
    return named(node);
  };

  /** The named interface or alias a member is written in. */
  const ownerOf = (node: Node): DeclarationRef | undefined => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (isInterfaceDeclaration(parent) || isTypeAliasDeclaration(parent)) return named(parent);
    }
    return undefined;
  };

  const named = (node: Node & { name: { text: string }; modifierFlags: ModifierFlags }) => {
    const file = context.fileOf(node.getSourceFile().fileName);
    if (file === undefined) throw new Unrepresentable();
    return {
      file,
      name: node.name.text,
      exported: (node.modifierFlags & ModifierFlags.Export) !== 0,
    };
  };

  const depend = (file: string) => {
    if (file !== context.file) dependencies.add(file.startsWith("pkg:") ? packageOf(file) : file);
  };

  /**
   * The files of every declaration a construct's text reaches, through the names it references
   * (`keyof X` reads `X`'s file and the files `X` reads, though its result names neither), or
   * `undefined` when a name it reaches resolves to nothing. The checker evaluates a missing name
   * as its error type, which gives a complete but wrong result: `keyof Missing` is
   * `string | number | symbol`.
   */
  const read = (written: Node): Set<string> | undefined => {
    const files = new Set<string>();
    const visited = new Set<number>();
    // A worklist, not recursion: an alias chain may be as long as a project makes it.
    const pending: Node[] = [written];
    // Set by `reach`, inside the walk.
    const found = { missing: false };
    const reach = (symbol: Symbol | undefined) => {
      const target =
        symbol && symbol.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      // tsgo gives a name that resolves to nothing, as its unknown symbol, no declaration.
      if (!target?.declarations.length) {
        found.missing = true;
        return;
      }
      if (visited.has(target.id)) return;
      visited.add(target.id);
      for (const handle of target.declarations) {
        const node = handle.resolve();
        const file = node && context.fileOf(node.getSourceFile().fileName);
        if (!node || file === undefined) continue;
        files.add(file);
        // A module's declaration is its file, which `import("./b.ts")` reads only for the names
        // its qualifier reaches.
        if (node.kind !== SyntaxKind.SourceFile) pending.push(node);
      }
    };
    const visit = (node: Node): void => {
      if (isTypeReferenceNode(node)) reach(checker.getSymbolAtLocation(node.typeName));
      else if (isTypeQueryNode(node)) reach(checker.getSymbolAtLocation(node.exprName));
      else if (isExpressionWithTypeArguments(node)) {
        reach(checker.getSymbolAtLocation(node.expression));
      } else if (isImportTypeNode(node)) {
        const name = node.qualifier ?? (isLiteralTypeNode(node.argument) && node.argument.literal);
        reach(name ? checker.getSymbolAtLocation(name) : undefined);
      }
      node.forEachChild(visit);
    };
    while (pending.length && !found.missing) visit(pending.pop()!);
    return found.missing ? undefined : files;
  };

  return {
    read,
    depend,
    /** The node for `type`, or `undefined`, with nothing added, when a shape cannot hold it. */
    convert(type: Type, optional: boolean, opaque: OpaqueNode): number | undefined {
      const mark = nodes.length;
      const deps = new Set(dependencies);
      at = opaque;
      try {
        return build(type, optional);
      } catch (error) {
        if (!(error instanceof Unrepresentable)) throw error;
        nodes.length = mark;
        for (const [key, id] of converted) if (id >= mark) converted.delete(key);
        dependencies.clear();
        for (const each of deps) dependencies.add(each);
        return undefined;
      }
    },
  };
}

/** `pkg:<name>` for a package's file, `pkg:<name>/<path>` or `pkg:<name>@<version>/<path>`. */
function packageOf(file: string): string {
  const segments = file.slice("pkg:".length).split("/");
  const name = segments[0]!.startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0]!;
  return `pkg:${name.replace(/(?<=.)@[^@/]*$/, "")}`;
}

/** The type names the type references in some nodes reference, each once, in source order. */
function references(nodes: readonly Node[]): string[] {
  const names: string[] = [];
  const visit = (node: Node): void => {
    if (isTypeReferenceNode(node)) {
      let name = node.typeName;
      while (isQualifiedName(name)) name = name.left;
      if (isIdentifier(name) && !names.includes(name.text)) names.push(name.text);
    }
    node.forEachChild(visit);
  };
  for (const node of nodes) visit(node);
  return names;
}
