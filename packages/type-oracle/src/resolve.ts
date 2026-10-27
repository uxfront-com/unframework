// The syntactic adapter's resolution (plan §5.5): a type as written, followed through the
// module's own declarations, its imports and their re-exports, packages included, into a
// TypeShape. Generic declarations are instantiated with their arguments, and the five utility
// types of §5.5 map the members of the object they are given. It is synchronous over the modules
// it is given. A module it needs but was not given is reported in `missing`, so the asynchronous
// adapter can read it and run again.

import type * as AST from "oxc-parser";

import { PACKAGE, candidates, isRelative, packageName, packageOf } from "./modules.ts";
import type { Declaration, SourceModule } from "./modules.ts";
import type {
  DeclarationRef,
  FunctionParameter,
  ObjectNode,
  ShapeMember,
  ShapeQuery,
  Span,
  TupleElement,
  TypeNode,
  TypeShape,
  UnresolvedType,
} from "./types.ts";

/** The modules resolution may read: `undefined` for one not read yet, `null` for no file. */
export interface ModuleSource {
  get(file: string): SourceModule | null | undefined;
  /**
   * The file a bare specifier, or any specifier in a package's file, names: a package's file as
   * `pkg:<name>/<path in the package>`, or `null` when there is none with types. Without it, no
   * package resolves.
   */
  resolve?(importer: string, specifier: string): string | null;
}

export interface Resolved {
  /** The shape, or `undefined` when the query names no type. */
  shape: TypeShape | undefined;
  /** The files resolution needed and was not given; the shape is final only when it is empty. */
  missing: string[];
  /** Every file resolution asked for, found or not: the shape holds until one of them changes. */
  files: Set<string>;
}

/** How many pairs one comparison may cache; past it, two types are not surely the same. */
const PAIRS = 1 << 20;

/** The utility types plan §5.5 names, which map the members of the object they are given. */
const UTILITIES = new Set(["Partial", "Required", "Pick", "Omit", "Readonly"]);

/**
 * How many instantiations of one declaration may be open inside one another. One that takes new
 * arguments inside itself (`interface N<T> { n: N<T[]> }`) never ends when expanded eagerly, as
 * this adapter expands; TypeScript instantiates its members lazily.
 */
const DEPTH = 10;

/** The construct each type the syntactic adapter cannot evaluate is reported as. */
const CONSTRUCTS: Record<string, string> = {
  TSConditionalType: "conditional",
  TSMappedType: "mapped",
  TSIndexedAccessType: "indexed-access",
  TSTypeQuery: "typeof",
  TSImportType: "import-type",
  TSTemplateLiteralType: "template-literal",
  TSInferType: "infer",
};

const KEYWORDS: Record<string, Extract<TypeNode, { kind: "primitive" }>["name"]> = {
  TSStringKeyword: "string",
  TSNumberKeyword: "number",
  TSBooleanKeyword: "boolean",
  TSBigIntKeyword: "bigint",
  TSSymbolKeyword: "symbol",
  TSObjectKeyword: "object",
  TSNullKeyword: "null",
  TSUndefinedKeyword: "undefined",
  TSVoidKeyword: "void",
  TSAnyKeyword: "any",
  TSUnknownKeyword: "unknown",
  TSNeverKeyword: "never",
};

/**
 * Resolves the type at `query.span` in `query.file`. With `follow` off, it reads no module but
 * the query's own, and every imported name is `external`.
 */
export function resolveQuery(modules: ModuleSource, query: ShapeQuery, follow: boolean): Resolved {
  const module = modules.get(query.file);
  const found = module ? findType(module.program, query.span) : undefined;
  if (!module || !found) return { shape: undefined, missing: [], files: new Set([query.file]) };
  const resolution = new Resolution(modules, module, follow);
  const root = resolution.convert(found.type, {
    module,
    parameters: found.parameters,
    bindings: new Map(),
    declaration: found.declaration && resolution.declarationRef(module, found.declaration),
  });
  resolution.finish();
  return {
    shape: resolution.shape(root),
    missing: [...resolution.missing].toSorted(),
    files: resolution.files,
  };
}

/** Where a type name is used: the reference, and the module it is written in. */
interface Use {
  module: SourceModule;
  node: AST.TSType;
}

/**
 * An object whose members come from other objects: an interface that extends bases, an
 * intersection of parts, or a utility type over the object it is given. Merges run once every
 * object is filled, so a part reached while it is still being read (`interface B extends A`,
 * inside `A`) contributes all its members.
 */
interface Merge {
  kind: "extends" | "intersection" | "utility";
  parts: { id: number; use: Use }[];
  /** A utility's name, and the keys a `Pick` or an `Omit` names. */
  utility?: { name: string; keys?: Set<string> };
}

interface Scope {
  module: SourceModule;
  /** The type parameters in scope at the query, by name. */
  parameters: Map<string, AST.TSTypeParameter>;
  /** The arguments of the generic declaration being instantiated, by its parameters' names. */
  bindings: Map<string, number>;
  /** The named declaration being read, which owns the members it writes. */
  declaration: DeclarationRef | undefined;
}

class Resolution {
  readonly missing = new Set<string>();
  readonly files = new Set<string>();
  readonly #nodes: TypeNode[] = [];
  readonly #interned = new Map<string, number>();
  readonly #construction = new Set<string>();
  readonly #dependencies = new Set<string>();
  readonly #unresolved: UnresolvedType[] = [];
  /**
   * The nodes that carry each `unresolved` entry: the opaque node it describes, the object that
   * lost the construct, and every object that took that object's members (#merge). The shape
   * keeps an entry while one of its carriers is reachable from the root, so an override that
   * discards a base's member discards what was unresolved in it, and nothing else.
   */
  readonly #carriers: number[][] = [];
  /** Objects with a computed key whose name the adapter cannot know. */
  readonly #open = new Set<number>();
  /** Each type parameter in scope at the query, as its node. */
  readonly #parameters = new Map<object, number>();
  /** Each declaration's instantiations, by `#key`. */
  readonly #instances = new Map<string, number>();
  readonly #ids = new Map<object, number>();
  readonly #resolving = new Set<string>();
  /** The instantiations of each declaration open inside one another, and those taking defaults. */
  readonly #nesting = new Map<object, number>();
  readonly #defaulting = new Set<object>();
  readonly #merges = new Map<number, Merge>();
  readonly #merged = new Map<number, "merging" | "done">();

  readonly modules: ModuleSource;
  readonly query: SourceModule;
  readonly follow: boolean;

  constructor(modules: ModuleSource, query: SourceModule, follow: boolean) {
    this.modules = modules;
    this.query = query;
    this.follow = follow;
  }

  shape(root: number): TypeShape {
    const reachable = new Set<number>();
    const visit = (id: number | undefined): void => {
      if (id === undefined || reachable.has(id)) return;
      reachable.add(id);
      const node = this.#nodes[id]!;
      if (node.kind === "union") node.types.forEach(visit);
      else if (node.kind === "array") visit(node.element);
      else if (node.kind === "tuple") for (const element of node.elements) visit(element.type);
      else if (node.kind === "object") {
        for (const member of node.members) visit(member.type);
        // A cycle prints the arguments: `Tree<string>`.
        node.typeArguments?.forEach(visit);
      } else if (node.kind === "typeParameter") visit(node.constraint);
      else if (node.kind === "function") {
        for (const parameter of node.parameters) visit(parameter.type);
        visit(node.returns);
      }
    };
    visit(root);
    return {
      root,
      nodes: this.#nodes,
      construction: [...this.#construction],
      dependencies: [...this.#dependencies].toSorted(),
      unresolved: this.#unresolved.filter((_, index) =>
        this.#carriers[index]!.some((carrier) => reachable.has(carrier)),
      ),
    };
  }

  /** Runs the merges, so every object holds its members. */
  finish(): void {
    for (const id of this.#merges.keys()) this.#merge(id);
  }

  #merge(id: number): void {
    const merge = this.#merges.get(id);
    if (!merge || this.#merged.has(id)) return;
    this.#merged.set(id, "merging");
    const node = this.#nodes[id] as ObjectNode;
    const members = [...node.members];
    for (const part of merge.parts) {
      if (this.#merged.get(part.id) === "merging") {
        // An interface that extends itself, or an intersection that contains itself (TS2310).
        this.#unsupported("circular", part.use.module, part.use.node, id);
        continue;
      }
      this.#merge(part.id);
      if (this.#open.has(part.id)) this.#open.add(id);
    }
    // A computed key of unknown name may override any member another object brings in.
    const open = this.#open.has(id);
    for (const part of merge.parts) {
      if (this.#merged.get(part.id) !== "done" && this.#merges.has(part.id)) continue;
      // What the part lost, the object that takes its members loses too.
      for (const carriers of this.#carriers) {
        if (carriers.includes(part.id) && !carriers.includes(id)) carriers.push(id);
      }
      for (const written of (this.#nodes[part.id] as ObjectNode).members) {
        // A utility maps its part's members, and has none of its own.
        const member = merge.utility ? this.#mapped(merge.utility, written) : written;
        if (!member) continue;
        const index = members.findIndex((other) => other.name === member.name);
        const first = members[index];
        // An interface's own member wins over its base's, and the first base over a later one.
        if (!first) {
          members.push(open ? { ...member, type: this.#kept(member, "unsupported") } : member);
        } else if (merge.kind === "extends" || open) continue;
        else if (!this.#same(first.type, member.type)) {
          // TypeScript intersects the two types; the member's type is kept as written.
          members[index] = { ...first, type: this.#kept(first, "conflict") };
        } else {
          // An intersection's member is optional, or readonly, only when every part that
          // declares it makes it so.
          members[index] = {
            ...first,
            optional: first.optional && member.optional,
            readonly: first.readonly && member.readonly,
          };
        }
      }
    }
    const [part] = merge.parts;
    const keys = merge.utility?.keys;
    if (keys && part && this.#merged.get(part.id) !== "merging") {
      const { name } = merge.utility!;
      // `2` and `"2"` are two keys to TypeScript and one name here, so a numeric name in the
      // object or in the keys leaves what `Pick` and `Omit` give unknown.
      const numeric =
        [...keys].some(isNumeric) ||
        (this.#nodes[part.id] as ObjectNode).members.some((m) => isNumeric(m.name));
      // A key the object lacks is an error (TS2344), so what `Pick` gives is not known.
      const missing =
        name === "Pick" && [...keys].some((key) => !members.some((m) => m.name === key));
      if (numeric || missing)
        this.#unsupported(`utility:${name}`, part.use.module, part.use.node, id);
    }
    node.members = members;
    this.#merged.set(id, "done");
  }

  /** A member as a utility maps it, or `undefined` for one it leaves out. */
  #mapped(utility: NonNullable<Merge["utility"]>, member: ShapeMember): ShapeMember | undefined {
    switch (utility.name) {
      case "Partial":
        return { ...member, optional: true };
      case "Readonly":
        return { ...member, readonly: true };
      case "Pick":
        return utility.keys!.has(member.name) ? member : undefined;
      case "Omit":
        return utility.keys!.has(member.name) ? undefined : member;
      default:
        return member.optional
          ? { ...member, optional: false, type: this.#defined(member) }
          : member;
    }
  }

  /**
   * An optional member's type without `undefined`, which `Required`'s `-?` takes out of it (as
   * TypeScript does without `exactOptionalPropertyTypes`). A type that may hold `undefined`
   * without saying so, a type parameter or `void`, is kept as written.
   */
  #defined(member: ShapeMember): number {
    const node = this.#nodes[member.type]!;
    const types = node.kind === "union" ? node.types : [member.type];
    const unknown = types.some((id) => {
      const type = this.#nodes[id]!;
      return type.kind === "typeParameter" || (type.kind === "primitive" && type.name === "void");
    });
    if (unknown) return this.#kept(member, "unsupported");
    const defined = types.filter((id) => {
      const type = this.#nodes[id]!;
      return !(type.kind === "primitive" && type.name === "undefined");
    });
    if (defined.length === types.length) return member.type;
    if (!defined.length) return this.#intern({ kind: "primitive", name: "never" });
    return defined.length === 1 ? defined[0]! : this.#intern({ kind: "union", types: defined });
  }

  /**
   * Whether two nodes are surely the same type. Each pair is compared once, so a shared type
   * costs one comparison. A pair met again while it is being compared, in a recursive type, is
   * not surely the same, and neither are two declared objects but one declaration, two opaque
   * nodes but one node, an object whose members are not all known yet, or one that lost a
   * construct (it carries an `unresolved` entry). Past `PAIRS` pairs, nothing more is sure.
   */
  #same(a: number, b: number): boolean {
    const known = new Map<string, boolean>();
    const lossy = new Set(this.#carriers.flat());
    const same = (x: number, y: number): boolean => {
      if (x === y) return true;
      const key = `${x}:${y}`;
      const cached = known.get(key);
      if (cached !== undefined) return cached;
      if (known.size >= PAIRS) return false;
      known.set(key, false);
      const result = compare(x, y);
      known.set(key, result);
      return result;
    };
    // Primitives and literals are interned, and opaque nodes and type parameters compare by
    // identity, so for them another node is another type.
    const scalar = (id: number) => {
      const { kind } = this.#nodes[id]!;
      return (
        kind === "primitive" || kind === "literal" || kind === "opaque" || kind === "typeParameter"
      );
    };
    // An object that only its own node can equal: declared, not settled, or lossy.
    const alone = (id: number) => {
      const node = this.#nodes[id]!;
      return node.kind === "object" && (!!node.declaration || !this.#settled(id) || lossy.has(id));
    };
    // Text two nodes share whenever they may be the same type, read `depth` levels down: a
    // necessary condition that is cheap to compare, so a union's members are searched only
    // among the members with the same text.
    const prints = new Map<number, string>();
    const fingerprint = (id: number, depth = 3): string => {
      const cached = depth === 3 ? prints.get(id) : undefined;
      if (cached !== undefined) return cached;
      const node = this.#nodes[id]!;
      const inner = (child: number) => fingerprint(child, depth - 1);
      let text: string;
      if (scalar(id)) text = `#${id}`;
      else if (depth === 0) text = node.kind;
      else if (node.kind === "union") {
        text = `|${[...new Set(node.types.map(inner))].toSorted().join(",")}`;
      } else if (node.kind === "array") text = `[${node.readonly}]${inner(node.element)}`;
      else if (node.kind === "tuple") {
        const elements = node.elements.map((e) => `${e.optional}${e.rest}${inner(e.type)}`);
        text = `(${node.readonly}${elements.join(",")})`;
      } else if (node.kind === "function") {
        const parameters = node.parameters.map((e) => `${e.optional}${e.rest}${inner(e.type)}`);
        text = `(${parameters.join(",")})=>${inner(node.returns)}`;
      } else {
        const members = (node as ObjectNode).members
          .map((m) => `${m.name}${m.optional}${m.readonly}:${inner(m.type)}`)
          .toSorted();
        text = `{${members.join(";")}}`;
      }
      if (depth === 3) prints.set(id, text);
      return text;
    };
    const covered = (from: readonly number[], to: readonly number[]) => {
      const ids = new Set(to);
      const byPrint = new Map<string, number[]>();
      for (const u of to) {
        if (scalar(u)) continue;
        const list = byPrint.get(fingerprint(u));
        if (list) list.push(u);
        else byPrint.set(fingerprint(u), [u]);
      }
      return from.every(
        (t) =>
          ids.has(t) || (!scalar(t) && (byPrint.get(fingerprint(t)) ?? []).some((u) => same(t, u))),
      );
    };
    const compare = (x: number, y: number): boolean => {
      const p = this.#nodes[x]!;
      const q = this.#nodes[y]!;
      switch (p.kind) {
        case "union":
          return q.kind === "union" && covered(p.types, q.types) && covered(q.types, p.types);
        case "array":
          return q.kind === "array" && p.readonly === q.readonly && same(p.element, q.element);
        case "tuple":
          return (
            q.kind === "tuple" &&
            p.readonly === q.readonly &&
            p.elements.length === q.elements.length &&
            p.elements.every((e, i) => {
              const f = q.elements[i]!;
              return e.optional === f.optional && e.rest === f.rest && same(e.type, f.type);
            })
          );
        case "function":
          return (
            q.kind === "function" &&
            p.parameters.length === q.parameters.length &&
            p.parameters.every((e, i) => {
              const f = q.parameters[i]!;
              return e.optional === f.optional && e.rest === f.rest && same(e.type, f.type);
            }) &&
            same(p.returns, q.returns)
          );
        case "object":
          return (
            q.kind === "object" &&
            !alone(x) &&
            !alone(y) &&
            p.members.length === q.members.length &&
            p.members.every((m) => {
              const n = q.members.find((other) => other.name === m.name);
              return (
                !!n &&
                m.optional === n.optional &&
                m.readonly === n.readonly &&
                same(m.type, n.type)
              );
            })
          );
        default:
          return false;
      }
    };
    return same(a, b);
  }

  /** Whether an object holds all its members: merged, if it merges, and with no unknown key. */
  #settled(id: number): boolean {
    return (!this.#merges.has(id) || this.#merged.get(id) === "done") && !this.#open.has(id);
  }

  /** A member's type kept as written, opaque, with an entry at that text's span. */
  #kept(member: ShapeMember, reason: UnresolvedType["reason"]): number {
    const span = member.typeText?.span ?? member.span;
    const source = this.modules.get(member.file)?.source ?? "";
    const id = this.#intern({
      kind: "opaque",
      text: member.typeText?.code ?? source.slice(span.start, span.end),
      file: member.file,
      span,
    });
    const known = this.#unresolved.some(
      (entry, index) => this.#carriers[index]!.includes(id) && entry.reason === reason,
    );
    if (!known) {
      this.#unresolved.push({ file: member.file, span, reason });
      this.#carriers.push([id]);
    }
    return id;
  }

  declarationRef(module: SourceModule, declaration: Declaration): DeclarationRef {
    const name = declaration.id.name;
    return { file: module.file, name, exported: module.exported.has(name) };
  }

  convert(type: AST.TSType, scope: Scope): number {
    const keyword = KEYWORDS[type.type];
    if (keyword) return this.#intern({ kind: "primitive", name: keyword });
    switch (type.type) {
      case "TSLiteralType":
        return this.#literal(type, scope);
      case "TSTemplateLiteralType":
        return type.types.length
          ? this.#unsupported("template-literal", scope.module, type)
          : this.#intern({
              kind: "literal",
              value: type.quasis.map((quasi) => quasi.value.cooked ?? "").join(""),
            });
      case "TSUnionType":
        return this.#union(type, scope);
      case "TSIntersectionType":
        return this.#intersection(type, scope);
      case "TSArrayType":
        return this.#intern({
          kind: "array",
          element: this.convert(type.elementType, scope),
          readonly: false,
        });
      case "TSTupleType":
        return this.#tuple(type, scope, false);
      case "TSTypeOperator":
        if (type.operator === "readonly" && type.typeAnnotation.type === "TSArrayType") {
          return this.#intern({
            kind: "array",
            element: this.convert(type.typeAnnotation.elementType, scope),
            readonly: true,
          });
        }
        if (type.operator === "readonly" && type.typeAnnotation.type === "TSTupleType") {
          return this.#tuple(type.typeAnnotation, scope, true);
        }
        return this.#unsupported(
          type.operator === "keyof" ? "keyof" : "unsupported",
          scope.module,
          type,
        );
      case "TSParenthesizedType":
        return this.convert(type.typeAnnotation, scope);
      case "TSFunctionType":
        return type.typeParameters
          ? this.#unsupported("generic", scope.module, type)
          : this.#function(type.params, type.returnType, scope);
      case "TSTypeLiteral": {
        // Its members belong to the declaration it is written in; the object itself is anonymous.
        const id = this.#object(undefined);
        this.#fill(id, type.members, scope);
        return id;
      }
      case "TSTypeReference":
        return this.#reference(type, scope);
      default:
        return this.#unsupported(CONSTRUCTS[type.type] ?? "unsupported", scope.module, type);
    }
  }

  #literal(type: AST.TSLiteralType, scope: Scope): number {
    const { literal } = type;
    if (literal.type === "Literal") {
      const { value } = literal;
      // A number JSON cannot hold (`1e400`) is not kept (P5).
      if (
        typeof value === "string" ||
        (typeof value === "number" && Number.isFinite(value)) ||
        typeof value === "boolean"
      ) {
        return this.#intern({ kind: "literal", value });
      }
    }
    if (
      literal.type === "UnaryExpression" &&
      literal.operator === "-" &&
      literal.argument.type === "Literal" &&
      typeof literal.argument.value === "number" &&
      Number.isFinite(literal.argument.value)
    ) {
      return this.#intern({ kind: "literal", value: -literal.argument.value });
    }
    if (literal.type === "TemplateLiteral" && !literal.expressions.length) {
      return this.#intern({
        kind: "literal",
        value: literal.quasis.map((quasi) => quasi.value.cooked ?? "").join(""),
      });
    }
    return this.#unsupported("unsupported", scope.module, type);
  }

  #union(type: AST.TSUnionType, scope: Scope): number {
    this.#construction.add("union");
    const types: number[] = [];
    for (const member of type.types) {
      const id = this.convert(member, scope);
      const node = this.#nodes[id]!;
      for (const part of node.kind === "union" ? node.types : [id]) {
        if (!types.includes(part)) types.push(part);
      }
    }
    return types.length === 1 ? types[0]! : this.#intern({ kind: "union", types });
  }

  /** An intersection, into `id` when an alias allocated its object before reading the parts. */
  #intersection(type: AST.TSIntersectionType, scope: Scope, target?: number): number {
    this.#construction.add("intersection");
    const id = target ?? this.#object(undefined);
    const parts: Merge["parts"] = [];
    for (const part of type.types) {
      const before = this.#unresolved.length;
      const partId = this.convert(part, scope);
      if (this.#nodes[partId]!.kind === "object") {
        parts.push({ id: partId, use: { module: scope.module, node: part } });
      } else if (this.#unresolved.length === before && !this.missing.size) {
        // An unresolved part is reported once, where it failed.
        this.#report("unsupported", scope.module, part, id);
      } else {
        // What was unresolved in it, the object that lost it carries too.
        for (let index = before; index < this.#carriers.length; index++) {
          if (!this.#carriers[index]!.includes(id)) this.#carriers[index]!.push(id);
        }
      }
    }
    this.#merges.set(id, { kind: "intersection", parts });
    return id;
  }

  #tuple(type: AST.TSTupleType, scope: Scope, readonly: boolean): number {
    const elements = type.elementTypes.map((element): TupleElement => {
      let name: string | undefined;
      let optional = false;
      let inner: AST.TSTupleElement = element;
      if (inner.type === "TSNamedTupleMember") {
        name = inner.label.name;
        optional = inner.optional;
        inner = inner.elementType;
      }
      if (inner.type === "TSOptionalType") {
        return {
          name,
          type: this.convert(inner.typeAnnotation, scope),
          optional: true,
          rest: false,
        };
      }
      if (inner.type === "TSRestType") {
        // A named rest element, `...rest: T[]`, is a rest type around a named member.
        const rest = inner.typeAnnotation as AST.TSType | AST.TSNamedTupleMember;
        if (rest.type === "TSNamedTupleMember") {
          const element = rest.elementType as AST.TSType;
          return {
            name: rest.label.name,
            type: this.convert(element, scope),
            optional,
            rest: true,
          };
        }
        return { name, type: this.convert(inner.typeAnnotation, scope), optional, rest: true };
      }
      return { name, type: this.convert(inner, scope), optional, rest: false };
    });
    return this.#intern({
      kind: "tuple",
      elements: elements.map((element) =>
        element.name === undefined ? withoutName(element) : element,
      ),
      readonly,
    });
  }

  #function(
    params: readonly AST.ParamPattern[],
    returnType: AST.TSTypeAnnotation | null,
    scope: Scope,
  ): number {
    const parameters: FunctionParameter[] = [];
    params.forEach((param, index) => {
      const rest = param.type === "RestElement";
      const pattern = rest ? param.argument : param;
      const annotation = param.type === "TSParameterProperty" ? null : param.typeAnnotation;
      parameters.push({
        name: pattern.type === "Identifier" ? pattern.name : `arg${index}`,
        type: annotation
          ? this.convert(annotation.typeAnnotation, scope)
          : this.#intern({ kind: "primitive", name: "any" }),
        // oxc types `optional` as `false` on a binding, but sets it on an optional parameter.
        optional: (pattern as { optional?: boolean }).optional === true,
        rest,
      });
    });
    const returns = returnType
      ? this.convert(returnType.typeAnnotation, scope)
      : this.#intern({ kind: "primitive", name: "any" });
    return this.#intern({ kind: "function", parameters, returns });
  }

  #reference(type: AST.TSTypeReference, scope: Scope): number {
    if (type.typeName.type !== "Identifier") {
      return this.#unsupported("qualified-name", scope.module, type);
    }
    const { name } = type.typeName;
    const args = type.typeArguments?.params;
    const bound = scope.bindings.get(name);
    const parameter = scope.parameters.get(name);
    if (bound !== undefined || parameter) {
      // A type parameter takes no arguments (TS2315).
      if (args) return this.#unsupported("generic", scope.module, type);
      return bound ?? this.#parameter(parameter!, scope);
    }
    return this.#named(scope, name, args, type);
  }

  /**
   * A type name with its arguments, used in `scope` at `at`: an array, a utility, or a name
   * declared, imported or global, instantiated with the arguments.
   */
  #named(
    scope: Scope,
    name: string,
    args: readonly AST.TSType[] | undefined,
    at: AST.TSType,
  ): number {
    if (args && !this.#bound(scope.module, name)) {
      if ((name === "Array" || name === "ReadonlyArray") && args.length === 1) {
        return this.#intern({
          kind: "array",
          element: this.convert(args[0]!, scope),
          readonly: name === "ReadonlyArray",
        });
      }
      if (UTILITIES.has(name)) return this.#utility(name, args, scope, at);
    }
    // A utility takes its arguments (TS2314).
    if (!args && UTILITIES.has(name) && !this.#bound(scope.module, name)) {
      return this.#unsupported(`utility:${name}`, scope.module, at);
    }
    const nodes = args?.map((arg) => this.convert(arg, scope));
    return this.#name(scope.module, name, at, nodes);
  }

  /**
   * A utility type of §5.5: an object whose members are its argument's, mapped when every object
   * is filled (#merge). An argument that is not an object, or keys that are not literals, leave
   * it opaque.
   */
  #utility(name: string, args: readonly AST.TSType[], scope: Scope, at: AST.TSType): number {
    const construct = `utility:${name}`;
    const keyed = name === "Pick" || name === "Omit";
    if (args.length !== (keyed ? 2 : 1)) return this.#unsupported(construct, scope.module, at);
    this.#construction.add(construct);
    const before = this.#unresolved.length;
    const part = this.convert(args[0]!, scope);
    const keys = keyed ? this.#keys(this.convert(args[1]!, scope)) : undefined;
    if (this.#nodes[part]!.kind !== "object" || (keyed && !keys)) {
      if (this.#unresolved.length === before && !this.missing.size) {
        return this.#unsupported(construct, scope.module, at);
      }
      // An argument that failed is reported once, where it failed; the utility carries it.
      const id = this.#opaque(scope.module, at);
      for (let index = before; index < this.#carriers.length; index++) {
        if (!this.#carriers[index]!.includes(id)) this.#carriers[index]!.push(id);
      }
      return id;
    }
    const id = this.#object(undefined);
    const use = { module: scope.module, node: at };
    this.#merges.set(id, {
      kind: "utility",
      parts: [{ id: part, use }],
      utility: keys ? { name, keys } : { name },
    });
    return id;
  }

  /** The names a key type holds: a literal, a union of literals, or `never` for none. */
  #keys(id: number): Set<string> | undefined {
    const node = this.#nodes[id]!;
    if (node.kind === "primitive" && node.name === "never") return new Set();
    const keys = new Set<string>();
    for (const type of node.kind === "union" ? node.types : [id]) {
      const key = this.#nodes[type]!;
      if (key.kind !== "literal" || typeof key.value === "boolean") return undefined;
      keys.add(String(key.value));
    }
    return keys;
  }

  /** Whether a module declares or imports a type name. */
  #bound(module: SourceModule, name: string): boolean {
    return module.declarations.has(name) || module.imports.has(name) || module.values.has(name);
  }

  #parameter(parameter: AST.TSTypeParameter, scope: Scope): number {
    const cached = this.#parameters.get(parameter);
    if (cached !== undefined) return cached;
    const id = this.#nodes.push({ kind: "typeParameter", name: parameter.name.name }) - 1;
    this.#parameters.set(parameter, id);
    if (parameter.constraint) {
      const constraint = this.convert(parameter.constraint, scope);
      this.#nodes[id] = { kind: "typeParameter", name: parameter.name.name, constraint };
    }
    return id;
  }

  /**
   * A type name used in `module` at `at`, with its arguments' nodes: declared there, imported, or
   * a global.
   */
  #name(module: SourceModule, name: string, at: AST.TSType, args?: readonly number[]): number {
    // A class or an enum, alone or merged with an interface, is not a type this adapter reads.
    if (module.values.has(name)) return this.#unsupported("class-or-enum", module, at);
    const use = { module, node: at };
    const declarations = module.declarations.get(name);
    if (declarations) return this.#declaration(module, declarations, use, args);
    const imported = module.imports.get(name);
    if (imported) {
      return this.#import(module, imported.specifier, imported.imported, use, new Set(), args);
    }
    // A generic global (`Record`, `Map`) is a type the adapter cannot evaluate.
    if (args) return this.#unsupported("generic", module, at);
    // Neither declared nor imported: a global of TypeScript's lib, which the type-checker judges.
    return this.#opaque(module, at);
  }

  /** An imported name, used at `use`: the module the import names, and the type it exports. */
  #import(
    from: SourceModule,
    specifier: string,
    imported: string,
    use: Use,
    seen: Set<string>,
    args?: readonly number[],
  ): number {
    if (!this.follow) return this.#report("external", use.module, use.node);
    if (specifier.startsWith("/")) return this.#report("missing-module", use.module, use.node);
    const target = this.#module(from.file, specifier);
    if (target === undefined) return this.#opaque(use.module, use.node);
    if (target === null) return this.#report("missing-module", use.module, use.node);
    this.#construction.add("import");
    return this.#exported(target, imported, use, seen, args);
  }

  /** The type a module exports as `name`, followed through its re-exports. */
  #exported(
    module: SourceModule,
    name: string,
    use: Use,
    seen: Set<string>,
    args?: readonly number[],
  ): number {
    const key = `${module.file}#${name}`;
    if (seen.has(key)) return this.#report("missing-export", use.module, use.node);
    seen.add(key);
    const entry = module.exports.get(name);
    if (entry?.kind === "reexport") {
      return this.#import(module, entry.specifier, entry.imported, use, seen, args);
    }
    if (entry) {
      if (module.values.has(entry.local)) {
        return this.#unsupported("class-or-enum", use.module, use.node);
      }
      const declarations = module.declarations.get(entry.local);
      if (declarations) return this.#declaration(module, declarations, use, args);
      const imported = module.imports.get(entry.local);
      if (imported) {
        return this.#import(module, imported.specifier, imported.imported, use, seen, args);
      }
      return this.#report("missing-export", use.module, use.node);
    }
    for (const specifier of module.starExports) {
      const target = this.#module(module.file, specifier);
      if (target === undefined) return this.#opaque(use.module, use.node);
      if (target && this.#exports(target, name, new Set())) {
        return this.#exported(target, name, use, seen, args);
      }
    }
    return this.#report("missing-export", use.module, use.node);
  }

  /** Whether a module exports a name, directly or through `export *`; true while it can't tell. */
  #exports(module: SourceModule, name: string, seen: Set<string>): boolean {
    if (module.exports.has(name)) return true;
    if (seen.has(module.file)) return false;
    seen.add(module.file);
    return module.starExports.some((specifier) => {
      const target = this.#module(module.file, specifier);
      return target === undefined || (target !== null && this.#exports(target, name, seen));
    });
  }

  /**
   * The module a specifier names: a relative one in the project through `readFile`, as written,
   * and a package, or any specifier in a package's file, through `resolve`. `undefined` while a
   * file it needs is unread, `null` when there is none.
   */
  #module(importer: string, specifier: string): SourceModule | null | undefined {
    // A subpath import (`#types`) maps through `package.json`, which this adapter does not read,
    // and an absolute path is outside the root.
    if (specifier.startsWith("#") || specifier.startsWith("/")) return null;
    if (!isRelative(specifier)) {
      const name = `${PACKAGE}${packageName(specifier)}`;
      this.#construction.add("package");
      this.#dependencies.add(name);
      // Installing the package changes what the specifier names.
      this.files.add(name);
    }
    const files =
      isRelative(specifier) && !importer.startsWith(PACKAGE)
        ? candidates(importer, specifier)
        : [this.modules.resolve?.(importer, specifier) ?? null];
    for (const file of files) {
      if (file === null) return null;
      this.files.add(file);
      const module = this.modules.get(file);
      if (module === undefined) {
        this.missing.add(file);
        return undefined;
      }
      if (module) {
        if (file.startsWith(PACKAGE)) {
          this.#dependencies.add(packageOf(file));
        } else if (file !== this.query.file) this.#dependencies.add(file);
        return module;
      }
    }
    return null;
  }

  /**
   * A declared name's type: an alias, or an interface with every declaration of it merged,
   * instantiated with `args`, its arguments' nodes, and its parameters' defaults.
   */
  #declaration(
    module: SourceModule,
    declarations: Declaration[],
    use: Use,
    args: readonly number[] = [],
  ): number {
    const declaration = declarations[0]!;
    // Interfaces of one name merge only when they declare the same type parameters (TS2428).
    if (declarations.some((each) => parameterNames(each) !== parameterNames(declaration))) {
      return this.#unsupported("generic", use.module, use.node);
    }
    if (
      declarations.length > 1 &&
      declarations.some((each) => each.type === "TSTypeAliasDeclaration")
    ) {
      // Only interfaces merge; a repeated alias is an error (TS2300).
      return this.#unsupported("duplicate-declaration", use.module, use.node);
    }
    const ref = this.declarationRef(module, declaration);
    const bindings = this.#arguments(module, declaration, ref, args);
    if (!bindings) return this.#unsupported("generic", use.module, use.node);
    if (bindings.size) this.#construction.add("generic");
    const typeArguments = [...bindings.values()];
    const key = this.#key(declaration, typeArguments);
    const cached = this.#instances.get(key);
    if (cached !== undefined) return cached;
    const nesting = this.#nesting.get(declaration) ?? 0;
    if (nesting >= DEPTH) return this.#unsupported("generic", use.module, use.node);
    this.#nesting.set(declaration, nesting + 1);
    const scope: Scope = { module, parameters: new Map(), bindings, declaration: ref };
    const id = this.#instantiate(declarations, scope, typeArguments, key, use);
    this.#nesting.set(declaration, nesting);
    return id;
  }

  /**
   * The arguments of a declaration's type parameters, by name: those written, then the
   * parameters' defaults, which may read the parameters before them. `undefined` when there are
   * too many, or a parameter has neither (TS2314).
   */
  #arguments(
    module: SourceModule,
    declaration: Declaration,
    ref: DeclarationRef,
    args: readonly number[],
  ): Map<string, number> | undefined {
    const parameters = declaration.typeParameters?.params ?? [];
    const bindings = new Map<string, number>();
    if (args.length > parameters.length) return undefined;
    if (args.length === parameters.length) {
      parameters.forEach((parameter, index) => bindings.set(parameter.name.name, args[index]!));
      return bindings;
    }
    // A default that needs its own declaration's defaults is an error (TS2744).
    if (this.#defaulting.has(declaration)) return undefined;
    this.#defaulting.add(declaration);
    const scope: Scope = { module, parameters: new Map(), bindings, declaration: ref };
    for (const [index, parameter] of parameters.entries()) {
      const arg = args[index];
      if (arg === undefined && !parameter.default) break;
      bindings.set(parameter.name.name, arg ?? this.convert(parameter.default!, scope));
    }
    this.#defaulting.delete(declaration);
    return bindings.size === parameters.length ? bindings : undefined;
  }

  /** The key of a declaration's instantiation: the declaration, and its arguments' nodes. */
  #key(declaration: Declaration, typeArguments: readonly number[]): string {
    let id = this.#ids.get(declaration);
    if (id === undefined) {
      id = this.#ids.size;
      this.#ids.set(declaration, id);
    }
    return `${id}<${typeArguments.join(",")}>`;
  }

  /** One instantiation of a declaration, cached by `key` before its members are read. */
  #instantiate(
    declarations: Declaration[],
    scope: Scope,
    typeArguments: number[],
    key: string,
    use: Use,
  ): number {
    const declaration = declarations[0]!;
    const { module, declaration: ref } = scope;
    if (declaration.type === "TSTypeAliasDeclaration") {
      if (declaration.typeAnnotation.type === "TSTypeLiteral") {
        const id = this.#object(ref, typeArguments);
        this.#instances.set(key, id);
        this.#fill(id, declaration.typeAnnotation.members, scope);
        return id;
      }
      // An intersection is an object too, so a cycle back to it finds it whichever type is queried.
      if (declaration.typeAnnotation.type === "TSIntersectionType") {
        const id = this.#object(ref, typeArguments);
        this.#instances.set(key, id);
        return this.#intersection(declaration.typeAnnotation, scope, id);
      }
      // An alias that reaches itself other than through an object is not a type (TS2456).
      if (this.#resolving.has(key)) {
        return this.#unsupported("unsupported", use.module, use.node);
      }
      this.#resolving.add(key);
      const start = this.#nodes.length;
      const id = this.convert(declaration.typeAnnotation, scope);
      this.#resolving.delete(key);
      // An object the alias itself builds (`type B = A & { x: string }`) is declared by it.
      const node = this.#nodes[id]!;
      if (id >= start && node.kind === "object" && !node.declaration) {
        node.declaration = ref;
        if (typeArguments.length) node.typeArguments = typeArguments;
      }
      this.#instances.set(key, id);
      return id;
    }
    const interfaces = declarations as AST.TSInterfaceDeclaration[];
    const id = this.#object(ref, typeArguments);
    this.#instances.set(key, id);
    this.#fill(
      id,
      interfaces.flatMap((each) => each.body.body),
      scope,
    );
    const parts: Merge["parts"] = [];
    for (const heritage of interfaces.flatMap((each) => each.extends)) {
      this.#construction.add("extends");
      const base = this.#heritage(heritage, scope, id);
      if (base !== undefined) {
        parts.push({ id: base, use: { module, node: heritage as unknown as AST.TSType } });
      }
    }
    if (parts.length) this.#merges.set(id, { kind: "extends", parts });
    return id;
  }

  /**
   * The object an interface extends, or `undefined`, reported, when it is not one. What is
   * reported belongs to the interface, `owner`, which lost the base's members.
   */
  #heritage(heritage: AST.TSInterfaceHeritage, scope: Scope, owner: number): number | undefined {
    const { expression } = heritage;
    const at = heritage as unknown as AST.TSType;
    if (expression.type !== "Identifier") {
      this.#unsupported("qualified-name", scope.module, at, owner);
      return undefined;
    }
    // An interface cannot extend a type parameter (TS2312).
    if (scope.bindings.has(expression.name)) {
      this.#unsupported("generic", scope.module, at, owner);
      return undefined;
    }
    const before = this.#unresolved.length;
    const id = this.#named(scope, expression.name, heritage.typeArguments?.params, at);
    if (this.#nodes[id]!.kind === "object") return id;
    if (this.#unresolved.length === before && !this.missing.size) {
      this.#report("unsupported", scope.module, at, owner);
    }
    for (let index = before; index < this.#carriers.length; index++) {
      if (!this.#carriers[index]!.includes(owner)) this.#carriers[index]!.push(owner);
    }
    return undefined;
  }

  /**
   * Writes an object's members from its signatures, in source order. A name written twice is
   * one member: the same type again is kept once, another type is a `conflict`, and an
   * overloaded method, which a member cannot hold, is unresolved. A member the adapter cannot
   * read keeps its name, with an opaque type, so no base or other part fills it in.
   */
  #fill(id: number, signatures: readonly AST.TSSignature[], scope: Scope): void {
    const members: ShapeMember[] = [];
    // Each method's first signature, by name, and the names whose type is kept as written.
    const methods = new Map<string, AST.TSType>();
    const written = new Set<string>();
    const add = (member: ShapeMember, at: AST.TSType, method: boolean) => {
      const index = members.findIndex((other) => other.name === member.name);
      const first = members[index];
      if (!first) {
        members.push(member);
        if (method) methods.set(member.name, at);
        return;
      }
      if (written.has(member.name)) return;
      written.add(member.name);
      const overloaded = methods.get(member.name);
      if (method && overloaded) {
        members[index] = {
          ...first,
          type: this.#unsupported("overload", scope.module, overloaded),
        };
      } else if (method || overloaded || !this.#same(first.type, member.type)) {
        members[index] = { ...first, type: this.#kept(first, "conflict") };
      } else {
        written.delete(member.name);
      }
    };
    for (const signature of signatures) {
      const at = signature as unknown as AST.TSType;
      if (signature.type !== "TSPropertySignature" && signature.type !== "TSMethodSignature") {
        this.#unsupported(
          signature.type === "TSIndexSignature" ? "index-signature" : "call-signature",
          scope.module,
          at,
          id,
        );
        continue;
      }
      // A computed key is a name only when it is a literal, `["aria-label"]: string`.
      const name =
        signature.computed && signature.key.type !== "Literal"
          ? undefined
          : memberName(signature.key);
      if (name === undefined) {
        // Its name may be any member's, so what other objects bring in is kept opaque (#merge).
        this.#unsupported("computed-key", scope.module, at, id);
        this.#open.add(id);
        continue;
      }
      const common = {
        name,
        optional: signature.optional,
        file: scope.module.file,
        ...(scope.declaration && { declaration: scope.declaration }),
        span: { start: signature.start, end: signature.end },
      };
      if (signature.type === "TSMethodSignature") {
        if (signature.kind !== "method" || signature.typeParameters) {
          const construct = signature.kind === "method" ? "generic" : "accessor";
          // Opaque whichever signature of the name comes first, an overload's included.
          const type = this.#unsupported(construct, scope.module, at);
          const index = members.findIndex((member) => member.name === name);
          if (index === -1) members.push({ ...common, readonly: false, type, references: [] });
          else if (!written.has(name)) members[index] = { ...members[index]!, type };
          written.add(name);
          continue;
        }
        const type = this.#function(signature.params, signature.returnType, scope);
        const refs = references([...signature.params, signature.returnType]);
        add({ ...common, readonly: false, type, references: refs }, at, true);
        continue;
      }
      const type = signature.typeAnnotation?.typeAnnotation;
      const member: ShapeMember = {
        ...common,
        readonly: signature.readonly,
        type: type ? this.convert(type, scope) : this.#intern({ kind: "primitive", name: "any" }),
        ...(type && {
          typeText: {
            code: scope.module.source.slice(type.start, type.end),
            span: { start: type.start, end: type.end },
          },
        }),
        references: references([type]),
      };
      add(member, at, false);
    }
    (this.#nodes[id] as ObjectNode).members = members;
  }

  #object(declaration: DeclarationRef | undefined, typeArguments: number[] = []): number {
    return (
      this.#nodes.push({
        kind: "object",
        ...(declaration && { declaration }),
        ...(typeArguments.length > 0 && { typeArguments }),
        members: [],
      }) - 1
    );
  }

  #intern(node: TypeNode): number {
    const key = JSON.stringify(node);
    const cached = this.#interned.get(key);
    if (cached !== undefined) return cached;
    const id = this.#nodes.push(node) - 1;
    this.#interned.set(key, id);
    return id;
  }

  #opaque(module: SourceModule, at: AST.TSType): number {
    return this.#intern({
      kind: "opaque",
      text: module.source.slice(at.start, at.end),
      file: module.file,
      span: { start: at.start, end: at.end },
    });
  }

  /** Reports `at` unresolved, carried by the opaque node it returns and by `owner`, if any. */
  #report(
    reason: UnresolvedType["reason"],
    module: SourceModule,
    at: AST.TSType,
    owner?: number,
  ): number {
    const id = this.#opaque(module, at);
    this.#unresolved.push({ file: module.file, span: { start: at.start, end: at.end }, reason });
    this.#carriers.push(owner === undefined ? [id] : [id, owner]);
    return id;
  }

  #unsupported(construct: string, module: SourceModule, at: AST.TSType, owner?: number): number {
    this.#construction.add(construct);
    return this.#report("unsupported", module, at, owner);
  }
}

/** Whether a member name is a number's text, as a numeric key (`2: number`) gives. */
function isNumeric(name: string): boolean {
  return name !== "" && String(Number(name)) === name;
}

/** A declaration's type parameters' names, as one string. */
function parameterNames(declaration: Declaration): string {
  return (declaration.typeParameters?.params ?? []).map((each) => each.name.name).join(",");
}

function withoutName(element: TupleElement): TupleElement {
  return { type: element.type, optional: element.optional, rest: element.rest };
}

/** A member key's name: an identifier, a string literal (`"aria-label"`) or a number. */
function memberName(key: AST.PropertyKey): string | undefined {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && (typeof key.value === "string" || typeof key.value === "number")) {
    return String(key.value);
  }
  return undefined;
}

/** The type names the type references in some nodes reference, each once, in source order. */
function references(nodes: readonly unknown[]): string[] {
  const names: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as { type?: unknown; typeName?: AST.TSTypeName };
    if (node.type === "TSTypeReference" && node.typeName) {
      let name: AST.TSTypeName = node.typeName;
      while (name.type === "TSQualifiedName") name = name.left;
      if (name.type === "Identifier" && !names.includes(name.name)) names.push(name.name);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "type" && typeof child === "object") visit(child);
    }
  };
  visit(nodes);
  return names;
}

interface Found {
  type: AST.TSType;
  parameters: Map<string, AST.TSTypeParameter>;
  declaration: Declaration | undefined;
}

/**
 * The type node at exactly `span`, with the type parameters of the declarations around it and
 * the top-level type declaration it is written in, if any.
 */
function findType(program: AST.Program, span: Span): Found | undefined {
  const ancestors: object[] = [];
  let found: AST.TSType | undefined;
  const visit = (value: unknown): void => {
    if (found || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const node = value as { type?: unknown; start?: number; end?: number };
    if (typeof node.start === "number" && typeof node.end === "number") {
      if (node.end < span.start || node.start > span.end) return;
      if (
        node.start === span.start &&
        node.end === span.end &&
        typeof node.type === "string" &&
        node.type.startsWith("TS") &&
        node.type !== "TSTypeAnnotation"
      ) {
        found = node as AST.TSType;
        return;
      }
    }
    ancestors.push(node);
    for (const [key, child] of Object.entries(node)) {
      if (key !== "type" && typeof child === "object") visit(child);
    }
    if (!found) ancestors.pop();
  };
  visit(program);
  if (!found) return undefined;
  const parameters = new Map<string, AST.TSTypeParameter>();
  let declaration: Declaration | undefined;
  for (const ancestor of ancestors) {
    const node = ancestor as { type?: string; typeParameters?: AST.TSTypeParameterDeclaration };
    if (node.typeParameters?.type === "TSTypeParameterDeclaration") {
      for (const parameter of node.typeParameters.params) {
        parameters.set(parameter.name.name, parameter);
      }
    }
    if (
      !declaration &&
      (node.type === "TSInterfaceDeclaration" || node.type === "TSTypeAliasDeclaration") &&
      (program.body as readonly object[]).some(
        (statement) =>
          statement === ancestor ||
          (statement as { declaration?: unknown }).declaration === ancestor,
      )
    ) {
      declaration = ancestor as Declaration;
    }
  }
  return { type: found, parameters, declaration };
}
