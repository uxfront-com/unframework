// The syntactic adapter's resolution (plan §5.5): a type as written, followed through the
// module's own declarations, its relative imports and their re-exports, into a TypeShape. It is
// synchronous over the modules it is given. A module it needs but was not given is reported in
// `missing`, so the asynchronous adapter can read it and run again.

import type * as AST from "oxc-parser";

import { candidates, isRelative, packageName } from "./modules.ts";
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
}

export interface Resolved {
  /** The shape, or `undefined` when the query names no type. */
  shape: TypeShape | undefined;
  /** The files resolution needed and was not given; the shape is final only when it is empty. */
  missing: string[];
}

/** The utility types plan §5.5 names, which this adapter leaves unresolved for now. */
const UTILITIES = new Set(["Partial", "Required", "Pick", "Omit", "Readonly"]);

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
  if (!module || !found) return { shape: undefined, missing: [] };
  const resolution = new Resolution(modules, module, follow);
  const root = resolution.convert(found.type, {
    module,
    parameters: found.parameters,
    declaration: found.declaration && resolution.declarationRef(module, found.declaration),
  });
  resolution.finish();
  return { shape: resolution.shape(root), missing: [...resolution.missing].toSorted() };
}

/** Where a type name is used: the reference, and the module it is written in. */
interface Use {
  module: SourceModule;
  node: AST.TSType;
}

/**
 * An object whose members come from other objects: an interface that extends bases, or an
 * intersection of parts. Merges run once every object is filled, so a part reached while it is
 * still being read (`interface B extends A`, inside `A`) contributes all its members.
 */
interface Merge {
  kind: "extends" | "intersection";
  parts: { id: number; use: Use }[];
}

interface Scope {
  module: SourceModule;
  /** The type parameters in scope, by name. */
  parameters: Map<string, AST.TSTypeParameter>;
  /** The named declaration being read, which owns the members it writes. */
  declaration: DeclarationRef | undefined;
}

class Resolution {
  readonly missing = new Set<string>();
  readonly #nodes: TypeNode[] = [];
  readonly #interned = new Map<string, number>();
  readonly #construction = new Set<string>();
  readonly #dependencies = new Set<string>();
  readonly #unresolved: UnresolvedType[] = [];
  /**
   * The node each `unresolved` entry belongs to: its opaque node, or the object that lost the
   * construct. The shape keeps an entry only when its node is reachable from the root, so an
   * override that discards a base's member discards what was unresolved in it.
   */
  readonly #owners: number[] = [];
  /** Objects with a computed key whose name the adapter cannot know. */
  readonly #open = new Set<number>();
  readonly #declarations = new Map<object, number>();
  readonly #resolving = new Set<object>();
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
      else if (node.kind === "object") for (const member of node.members) visit(member.type);
      else if (node.kind === "typeParameter") visit(node.constraint);
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
      unresolved: this.#unresolved.filter((_, index) => reachable.has(this.#owners[index]!)),
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
      for (const member of (this.#nodes[part.id] as ObjectNode).members) {
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
    node.members = members;
    this.#merged.set(id, "done");
  }

  /**
   * Whether two nodes are surely the same type. Pairs under comparison are assumed equal, so a
   * recursive type compares in one pass, and a shared one once; a comparison that fails takes
   * back what it assumed. Two declared objects are the same only as one declaration, and two
   * opaque nodes only as one node: anything uncertain is not the same.
   */
  #same(a: number, b: number): boolean {
    const assumed = new Set<string>();
    const trail: string[] = [];
    const same = (x: number, y: number): boolean => {
      if (x === y) return true;
      const key = `${x}:${y}`;
      if (assumed.has(key)) return true;
      const mark = trail.length;
      assumed.add(key);
      trail.push(key);
      const result = compare(x, y);
      if (!result) for (const undone of trail.splice(mark)) assumed.delete(undone);
      return result;
    };
    const compare = (x: number, y: number): boolean => {
      const p = this.#nodes[x]!;
      const q = this.#nodes[y]!;
      switch (p.kind) {
        case "primitive":
          return q.kind === "primitive" && p.name === q.name;
        case "literal":
          return q.kind === "literal" && p.value === q.value;
        case "union":
          return (
            q.kind === "union" &&
            p.types.every((t) => q.types.some((u) => same(t, u))) &&
            q.types.every((u) => p.types.some((t) => same(t, u)))
          );
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
        case "object": {
          if (q.kind !== "object" || p.declaration || q.declaration) return false;
          if (!this.#settled(x) || !this.#settled(y)) return false;
          return (
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
        }
        default:
          return false;
      }
    };
    return same(a, b);
  }

  /** Whether an object holds all its members, merging it first if it can be. */
  #settled(id: number): boolean {
    if (!this.#merges.has(id)) return !this.#open.has(id);
    if (this.#merged.get(id) !== "merging") this.#merge(id);
    return this.#merged.get(id) === "done" && !this.#open.has(id);
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
      (entry, index) => this.#owners[index] === id && entry.reason === reason,
    );
    if (!known) {
      this.#unresolved.push({ file: member.file, span, reason });
      this.#owners.push(id);
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
        // Its entry belongs to the object that lost it.
        for (let index = before; index < this.#owners.length; index++) this.#owners[index] = id;
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
      if (pattern.type === "Identifier" && pattern.name === "this") return;
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
    const local = scope.parameters.has(name) || this.#bound(scope.module, name);
    const args = type.typeArguments?.params;
    if (args) {
      if (!local && (name === "Array" || name === "ReadonlyArray") && args.length === 1) {
        return this.#intern({
          kind: "array",
          element: this.convert(args[0]!, scope),
          readonly: name === "ReadonlyArray",
        });
      }
      return this.#unsupported(
        !local && UTILITIES.has(name) ? `utility:${name}` : "generic",
        scope.module,
        type,
      );
    }
    const parameter = scope.parameters.get(name);
    if (parameter) return this.#parameter(parameter, scope);
    return this.#name(scope.module, name, type);
  }

  /** Whether a module declares or imports a type name. */
  #bound(module: SourceModule, name: string): boolean {
    return module.declarations.has(name) || module.imports.has(name) || module.values.has(name);
  }

  #parameter(parameter: AST.TSTypeParameter, scope: Scope): number {
    const cached = this.#declarations.get(parameter);
    if (cached !== undefined) return cached;
    const id = this.#nodes.push({ kind: "typeParameter", name: parameter.name.name }) - 1;
    this.#declarations.set(parameter, id);
    if (parameter.constraint) {
      const constraint = this.convert(parameter.constraint, scope);
      this.#nodes[id] = { kind: "typeParameter", name: parameter.name.name, constraint };
    }
    return id;
  }

  /** A type name used in `module` at `at`: declared there, imported, or a global. */
  #name(module: SourceModule, name: string, at: AST.TSType): number {
    // A class or an enum, alone or merged with an interface, is not a type this adapter reads.
    if (module.values.has(name)) return this.#unsupported("class-or-enum", module, at);
    const declarations = module.declarations.get(name);
    if (declarations) return this.#declaration(module, declarations, { module, node: at });
    const imported = module.imports.get(name);
    if (imported) {
      const use = { module, node: at };
      return this.#import(module, imported.specifier, imported.imported, use, new Set());
    }
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
  ): number {
    if (!this.follow) return this.#report("external", use.module, use.node);
    if (specifier.startsWith("/")) return this.#report("missing-module", use.module, use.node);
    if (!isRelative(specifier)) {
      this.#dependencies.add(`pkg:${packageName(specifier)}`);
      return this.#unsupported("package", use.module, use.node);
    }
    const target = this.#module(from.file, specifier);
    if (target === undefined) return this.#opaque(use.module, use.node);
    if (target === null) return this.#report("missing-module", use.module, use.node);
    this.#construction.add("import");
    return this.#exported(target, imported, use, seen);
  }

  /** The type a module exports as `name`, followed through its re-exports. */
  #exported(module: SourceModule, name: string, use: Use, seen: Set<string>): number {
    const key = `${module.file}#${name}`;
    if (seen.has(key)) return this.#report("missing-export", use.module, use.node);
    seen.add(key);
    const entry = module.exports.get(name);
    if (entry?.kind === "reexport") {
      return this.#import(module, entry.specifier, entry.imported, use, seen);
    }
    if (entry) {
      if (module.values.has(entry.local)) {
        return this.#unsupported("class-or-enum", use.module, use.node);
      }
      const declarations = module.declarations.get(entry.local);
      if (declarations) return this.#declaration(module, declarations, use);
      const imported = module.imports.get(entry.local);
      if (imported) return this.#import(module, imported.specifier, imported.imported, use, seen);
      return this.#report("missing-export", use.module, use.node);
    }
    for (const specifier of module.starExports) {
      if (!isRelative(specifier)) continue;
      const target = this.#module(module.file, specifier);
      if (target === undefined) return this.#opaque(use.module, use.node);
      if (target && this.#exports(target, name, new Set())) {
        return this.#exported(target, name, use, seen);
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
      if (!isRelative(specifier)) return false;
      const target = this.#module(module.file, specifier);
      return target === undefined || (target !== null && this.#exports(target, name, seen));
    });
  }

  /** The module a relative specifier names; `undefined` while one of its candidates is unread. */
  #module(importer: string, specifier: string): SourceModule | null | undefined {
    for (const file of candidates(importer, specifier)) {
      const module = this.modules.get(file);
      if (module === undefined) {
        this.missing.add(file);
        return undefined;
      }
      if (module) {
        if (module.file !== this.query.file) this.#dependencies.add(module.file);
        return module;
      }
    }
    return null;
  }

  /** A declared name's type: an alias, or an interface with every declaration of it merged. */
  #declaration(module: SourceModule, declarations: Declaration[], use: Use): number {
    const declaration = declarations[0]!;
    const cached = this.#declarations.get(declaration);
    if (cached !== undefined) return cached;
    if (declarations.some((each) => each.typeParameters)) {
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
    const scope: Scope = { module, parameters: new Map(), declaration: ref };
    if (declaration.type === "TSTypeAliasDeclaration") {
      if (declaration.typeAnnotation.type === "TSTypeLiteral") {
        const id = this.#object(ref);
        this.#declarations.set(declaration, id);
        this.#fill(id, declaration.typeAnnotation.members, scope);
        return id;
      }
      // An intersection is an object too, so a cycle back to it finds it whichever type is queried.
      if (declaration.typeAnnotation.type === "TSIntersectionType") {
        const id = this.#object(ref);
        this.#declarations.set(declaration, id);
        return this.#intersection(declaration.typeAnnotation, scope, id);
      }
      // An alias that reaches itself other than through an object is not a type (TS2456).
      if (this.#resolving.has(declaration)) {
        return this.#unsupported("unsupported", use.module, use.node);
      }
      this.#resolving.add(declaration);
      const start = this.#nodes.length;
      const id = this.convert(declaration.typeAnnotation, scope);
      this.#resolving.delete(declaration);
      // An object the alias itself builds (`type B = A & { x: string }`) is declared by it.
      const node = this.#nodes[id]!;
      if (id >= start && node.kind === "object" && !node.declaration) node.declaration = ref;
      this.#declarations.set(declaration, id);
      return id;
    }
    const interfaces = declarations as AST.TSInterfaceDeclaration[];
    const id = this.#object(ref);
    this.#declarations.set(declaration, id);
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
    if (heritage.typeArguments) {
      const { name } = expression;
      this.#unsupported(
        !this.#bound(scope.module, name) && UTILITIES.has(name) ? `utility:${name}` : "generic",
        scope.module,
        at,
        owner,
      );
      return undefined;
    }
    const before = this.#unresolved.length;
    const id = this.#name(scope.module, expression.name, at);
    if (this.#nodes[id]!.kind === "object") return id;
    if (this.#unresolved.length === before && !this.missing.size) {
      this.#report("unsupported", scope.module, at, owner);
    }
    for (let index = before; index < this.#owners.length; index++) this.#owners[index] = owner;
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

  #object(declaration: DeclarationRef | undefined): number {
    return (
      this.#nodes.push({ kind: "object", ...(declaration && { declaration }), members: [] }) - 1
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

  /** Reports `at` unresolved, owned by `owner` or else by the opaque node it returns. */
  #report(
    reason: UnresolvedType["reason"],
    module: SourceModule,
    at: AST.TSType,
    owner?: number,
  ): number {
    const id = this.#opaque(module, at);
    this.#unresolved.push({ file: module.file, span: { start: at.start, end: at.end }, reason });
    this.#owners.push(owner ?? id);
    return id;
  }

  #unsupported(construct: string, module: SourceModule, at: AST.TSType, owner?: number): number {
    this.#construction.add(construct);
    return this.#report("unsupported", module, at, owner);
  }
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
