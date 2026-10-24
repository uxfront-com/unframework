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

/** The utility types plan §5.5 names, which the syntactic adapter evaluates from L4 on. */
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
  return { shape: resolution.shape(root), missing: [...resolution.missing].toSorted() };
}

/** Where a type name is used: the reference, and the module it is written in. */
interface Use {
  module: SourceModule;
  node: AST.TSType;
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
  readonly #declarations = new Map<object, number>();
  readonly #resolving = new Set<object>();

  readonly modules: ModuleSource;
  readonly query: SourceModule;
  readonly follow: boolean;

  constructor(modules: ModuleSource, query: SourceModule, follow: boolean) {
    this.modules = modules;
    this.query = query;
    this.follow = follow;
  }

  shape(root: number): TypeShape {
    return {
      root,
      nodes: this.#nodes,
      construction: [...this.#construction],
      dependencies: [...this.#dependencies].toSorted(),
      unresolved: this.#unresolved,
    };
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
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return this.#intern({ kind: "literal", value });
      }
    }
    if (
      literal.type === "UnaryExpression" &&
      literal.operator === "-" &&
      literal.argument.type === "Literal" &&
      typeof literal.argument.value === "number"
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

  #intersection(type: AST.TSIntersectionType, scope: Scope): number {
    this.#construction.add("intersection");
    const members: ShapeMember[] = [];
    for (const part of type.types) {
      const before = this.#unresolved.length;
      const node = this.#nodes[this.convert(part, scope)]!;
      if (node.kind !== "object") {
        // An unresolved part is reported once, where it failed.
        if (this.#unresolved.length === before && !this.missing.size) {
          this.#report("unsupported", scope.module, part);
        }
        continue;
      }
      for (const member of node.members) {
        const first = members.find((other) => other.name === member.name);
        if (!first) members.push(member);
        else if (first.type !== member.type) {
          this.#unresolved.push({ file: member.file, span: member.span, reason: "conflict" });
        }
      }
    }
    const id = this.#object(undefined);
    (this.#nodes[id] as ObjectNode).members = members;
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
    return module.declarations.has(name) || module.imports.has(name);
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
    const declaration = module.declarations.get(name);
    if (declaration) return this.#declaration(module, declaration, { module, node: at });
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
      const declaration = module.declarations.get(entry.local);
      if (declaration) return this.#declaration(module, declaration, use);
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

  #declaration(module: SourceModule, declaration: Declaration, use: Use): number {
    const cached = this.#declarations.get(declaration);
    if (cached !== undefined) return cached;
    if (declaration.typeParameters) return this.#unsupported("generic", use.module, use.node);
    const ref = this.declarationRef(module, declaration);
    const scope: Scope = { module, parameters: new Map(), declaration: ref };
    if (declaration.type === "TSTypeAliasDeclaration") {
      if (declaration.typeAnnotation.type === "TSTypeLiteral") {
        const id = this.#object(ref);
        this.#declarations.set(declaration, id);
        this.#fill(id, declaration.typeAnnotation.members, scope);
        return id;
      }
      // An alias that reaches itself other than through an object is not a type (TS2456).
      if (this.#resolving.has(declaration)) {
        return this.#unsupported("unsupported", use.module, use.node);
      }
      this.#resolving.add(declaration);
      const id = this.convert(declaration.typeAnnotation, scope);
      this.#resolving.delete(declaration);
      this.#declarations.set(declaration, id);
      return id;
    }
    const id = this.#object(ref);
    this.#declarations.set(declaration, id);
    this.#fill(id, declaration.body.body, scope);
    const node = this.#nodes[id] as ObjectNode;
    for (const heritage of declaration.extends) {
      this.#construction.add("extends");
      const base = this.#heritage(heritage, scope);
      if (!base) continue;
      for (const member of base.members) {
        if (!node.members.some((own) => own.name === member.name)) node.members.push(member);
      }
    }
    return id;
  }

  /** The object an interface extends, or `undefined`, reported, when it is not one. */
  #heritage(heritage: AST.TSInterfaceHeritage, scope: Scope): ObjectNode | undefined {
    const { expression } = heritage;
    const at = heritage as unknown as AST.TSType;
    if (expression.type !== "Identifier") {
      this.#unsupported("qualified-name", scope.module, at);
      return undefined;
    }
    if (heritage.typeArguments) {
      const { name } = expression;
      this.#unsupported(
        !this.#bound(scope.module, name) && UTILITIES.has(name) ? `utility:${name}` : "generic",
        scope.module,
        at,
      );
      return undefined;
    }
    const before = this.#unresolved.length;
    const node = this.#nodes[this.#name(scope.module, expression.name, at)]!;
    if (node.kind === "object") return node;
    if (this.#unresolved.length === before && !this.missing.size) {
      this.#report("unsupported", scope.module, at);
    }
    return undefined;
  }

  /** Writes an object's members from its signatures, in source order. */
  #fill(id: number, signatures: readonly AST.TSSignature[], scope: Scope): void {
    const members: ShapeMember[] = [];
    for (const signature of signatures) {
      const at = signature as unknown as AST.TSType;
      if (signature.type !== "TSPropertySignature" && signature.type !== "TSMethodSignature") {
        this.#unsupported(
          signature.type === "TSIndexSignature" ? "index-signature" : "call-signature",
          scope.module,
          at,
        );
        continue;
      }
      const name = signature.computed ? undefined : memberName(signature.key);
      if (name === undefined) {
        this.#unsupported("computed-key", scope.module, at);
        continue;
      }
      const span = { start: signature.start, end: signature.end };
      if (signature.type === "TSMethodSignature") {
        if (signature.kind !== "method" || signature.typeParameters) {
          this.#unsupported(signature.kind === "method" ? "generic" : "accessor", scope.module, at);
          continue;
        }
        members.push({
          name,
          optional: signature.optional,
          readonly: false,
          type: this.#function(signature.params, signature.returnType, scope),
          file: scope.module.file,
          ...(scope.declaration && { declaration: scope.declaration }),
          span,
          references: references([...signature.params, signature.returnType]),
        });
        continue;
      }
      const type = signature.typeAnnotation?.typeAnnotation;
      members.push({
        name,
        optional: signature.optional,
        readonly: signature.readonly,
        type: type ? this.convert(type, scope) : this.#intern({ kind: "primitive", name: "any" }),
        file: scope.module.file,
        ...(scope.declaration && { declaration: scope.declaration }),
        span,
        ...(type && {
          typeText: {
            code: scope.module.source.slice(type.start, type.end),
            span: { start: type.start, end: type.end },
          },
        }),
        references: references([type]),
      });
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

  #report(reason: UnresolvedType["reason"], module: SourceModule, at: AST.TSType): number {
    this.#unresolved.push({ file: module.file, span: { start: at.start, end: at.end }, reason });
    return this.#opaque(module, at);
  }

  #unsupported(construct: string, module: SourceModule, at: AST.TSType): number {
    this.#construction.add(construct);
    return this.#report("unsupported", module, at);
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
