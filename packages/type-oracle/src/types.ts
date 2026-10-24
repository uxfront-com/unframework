// The type oracle's seam (plan §5.5, ADR-0067): coarse-grained, asynchronous, and serialisable,
// which is what an IPC-backed checker needs. Every adapter answers the same queries with the same
// shapes, which the contract suite (`@unframework/type-oracle/contract`) holds them to.

/** A half-open range `[start, end)` of UTF-16 offsets into a file's source. */
export interface Span {
  start: number;
  end: number;
}

/**
 * A type as written in a file: a props annotation, a macro's type argument, an injection key's
 * type. `file` is relative to the oracle's root, with forward slashes, and `span` is the type
 * node's own span in it.
 */
export interface ShapeQuery {
  file: string;
  span: Span;
}

/** A type to print, named as a {@link ShapeQuery} names it. */
export type TypeQuery = ShapeQuery;

/** The files that changed, were created or were deleted, relative to the oracle's root. */
export interface FileChanges {
  files: string[];
}

export interface TypeOracle {
  /** Resolves the shape of a type at a location: props, emits, slot props, model types. */
  resolveShape(query: ShapeQuery): Promise<TypeShape>;
  /** Prints a type in a form every target's type system accepts. */
  printType(query: TypeQuery): Promise<string>;
  /** Tells the oracle which files changed, for incremental builds. */
  update(changes: FileChanges): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * What a type resolves to: a table of nodes, so a recursive type is a cycle of ids rather than
 * an infinite tree, and the whole shape survives `JSON.stringify` (P5). A construct the adapter
 * cannot evaluate is an `opaque` node with an entry in `unresolved`, never a wrong node.
 */
export interface TypeShape {
  /** The index in `nodes` of the queried type. */
  root: number;
  nodes: TypeNode[];
  /**
   * How the type is built, each construct once, in the order resolution met it: `import`,
   * `extends`, `intersection` and `union`, and for what it could not evaluate `package`,
   * `generic`, `utility:<Name>` (`utility:Pick`), `conditional`, `mapped`, `indexed-access`,
   * `keyof`, `typeof`, `template-literal`, `import-type`, `infer`, `qualified-name`,
   * `class-or-enum`, `index-signature`, `call-signature`, `computed-key`, `accessor`, `overload`,
   * `circular`, `duplicate-declaration` or `unsupported`.
   */
  construction: string[];
  /**
   * What the shape was read from, besides the query's own file, sorted: files relative to the
   * root, and packages as `pkg:<name>`. Never an absolute path (P8).
   */
  dependencies: string[];
  /** The spans the adapter could not resolve, in the order it met them. */
  unresolved: UnresolvedType[];
}

export type TypeNode =
  | PrimitiveNode
  | LiteralNode
  | UnionNode
  | ArrayNode
  | TupleNode
  | ObjectNode
  | FunctionNode
  | TypeParameterNode
  | OpaqueNode;

export interface PrimitiveNode {
  kind: "primitive";
  name:
    | "string"
    | "number"
    | "boolean"
    | "bigint"
    | "symbol"
    | "object"
    | "null"
    | "undefined"
    | "void"
    | "any"
    | "unknown"
    | "never";
}

export interface LiteralNode {
  kind: "literal";
  value: string | number | boolean;
}

/** A union, flattened: no member is itself a union, and no node appears twice. */
export interface UnionNode {
  kind: "union";
  types: number[];
}

export interface ArrayNode {
  kind: "array";
  element: number;
  readonly: boolean;
}

export interface TupleNode {
  kind: "tuple";
  elements: TupleElement[];
  readonly: boolean;
}

export interface TupleElement {
  /** The label of a named member, `[value: string]`. */
  name?: string;
  type: number;
  optional: boolean;
  rest: boolean;
}

export interface ObjectNode {
  kind: "object";
  /** The interface or alias that declares this object, when one does. */
  declaration?: DeclarationRef;
  members: ShapeMember[];
}

export interface FunctionNode {
  kind: "function";
  parameters: FunctionParameter[];
  returns: number;
}

export interface FunctionParameter {
  name: string;
  type: number;
  optional: boolean;
  rest: boolean;
}

/** A type parameter in scope at the query, such as `T` in `function List<T>(…)`. */
export interface TypeParameterNode {
  kind: "typeParameter";
  name: string;
  constraint?: number;
}

/**
 * A type the adapter keeps as written: a global of TypeScript's lib (`Date`, `Element`), which
 * is not unresolved, or a construct it could not evaluate, which has its entry in `unresolved`.
 */
export interface OpaqueNode {
  kind: "opaque";
  /** The type's text as written. */
  text: string;
  file: string;
  span: Span;
}

/** A named `interface` or `type` declaration. */
export interface DeclarationRef {
  /** The declaring file, relative to the root. */
  file: string;
  name: string;
  exported: boolean;
}

export interface ShapeMember {
  name: string;
  optional: boolean;
  readonly: boolean;
  type: number;
  /** The file the member is written in, relative to the root. */
  file: string;
  /** The named declaration it belongs to; absent for a type literal written in place. */
  declaration?: DeclarationRef;
  /** The member's own span in `file`: its signature, as the parser spans it. */
  span: Span;
  /** The member's type as written in `file`, with its span; absent when it has none. */
  typeText?: TypeText;
  /** The type names its type references, each once, in source order. */
  references: string[];
}

export interface TypeText {
  code: string;
  span: Span;
}

export interface UnresolvedType {
  file: string;
  span: Span;
  /**
   * Why: `missing-module` (the file cannot be read), `missing-export` (the module declares or
   * exports no such type), `external` (an import that the in-module path does not follow),
   * `unsupported` (a construct this adapter cannot evaluate, named in `construction`) or
   * `conflict` (two parts of an intersection, or two declarations of an interface, write one
   * member with different types; the member's type is kept as written).
   */
  reason: "missing-module" | "missing-export" | "external" | "unsupported" | "conflict";
}
