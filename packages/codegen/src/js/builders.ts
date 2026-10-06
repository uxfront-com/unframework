// Builders for the ESTree (TS-ESTree) nodes that targets synthesise. Synthesised code is
// built as AST and printed with oxc-codegen (plan §5.4), never glued from strings. Code copied
// from the source (expressions, type annotations) enters the AST through `Placeholders`, never
// as an identifier whose name is code.
import type * as AST from "@oxc-project/types";

const at = { start: 0, end: 0 } as const;

/** Whether a name can be written as an identifier (and so as a bare property key). */
function isIdentifierName(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

// --- Identifiers and literals ---------------------------------------------------------------

export function identifier(name: string): AST.IdentifierReference {
  return { type: "Identifier", name, ...at } as AST.IdentifierReference;
}

/** A binding identifier, with a type annotation when given (`props: Props`). */
export function bindingIdentifier(
  name: string,
  typeAnnotation?: AST.TSType,
): AST.BindingIdentifier {
  return {
    type: "Identifier",
    name,
    ...(typeAnnotation ? { typeAnnotation: tsTypeAnnotation(typeAnnotation) } : {}),
    ...at,
  } as AST.BindingIdentifier;
}

export function stringLiteral(value: string): AST.StringLiteral {
  return { type: "Literal", value, raw: JSON.stringify(value), ...at } as AST.StringLiteral;
}

export function booleanLiteral(value: boolean): AST.BooleanLiteral {
  return { type: "Literal", value, raw: String(value), ...at } as AST.BooleanLiteral;
}

export function nullLiteral(): AST.NullLiteral {
  return { type: "Literal", value: null, raw: "null", ...at } as AST.NullLiteral;
}

/**
 * A number literal. oxc-codegen prints it in its shortest form (`1000` as `1e3`), so a number
 * that must read as written goes through a placeholder instead; small integers print as they
 * are. A negative number is a unary minus.
 */
export function numberLiteral(value: number): AST.NumericLiteral | AST.UnaryExpression {
  if (value < 0 || Object.is(value, -0)) return unaryExpression("-", numberLiteral(-value));
  return { type: "Literal", value, raw: String(value), ...at } as AST.NumericLiteral;
}

/** A template literal without expressions. Escapes backticks, `${` and backslashes. */
export function templateLiteral(text: string): AST.TemplateLiteral {
  const raw = text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return {
    type: "TemplateLiteral",
    quasis: [{ type: "TemplateElement", value: { raw, cooked: text }, tail: true, ...at }],
    expressions: [],
    ...at,
  } as unknown as AST.TemplateLiteral;
}

// --- Programs and modules -------------------------------------------------------------------

export function program(body: AST.Statement[]): AST.Program {
  return { type: "Program", sourceType: "module", hashbang: null, body, ...at } as AST.Program;
}

export function importDeclaration(
  source: string,
  specifiers: AST.ImportDeclarationSpecifier[],
  importKind: "value" | "type" = "value",
): AST.ImportDeclaration {
  return {
    type: "ImportDeclaration",
    specifiers,
    source: stringLiteral(source),
    attributes: [],
    phase: null,
    importKind,
    ...at,
  } as AST.ImportDeclaration;
}

export function importSpecifier(
  imported: string,
  local: string = imported,
  importKind: "value" | "type" = "value",
): AST.ImportSpecifier {
  return {
    type: "ImportSpecifier",
    imported: identifier(imported),
    local: bindingIdentifier(local),
    importKind,
    ...at,
  } as AST.ImportSpecifier;
}

export function importDefaultSpecifier(local: string): AST.ImportDefaultSpecifier {
  return {
    type: "ImportDefaultSpecifier",
    local: bindingIdentifier(local),
    ...at,
  } as AST.ImportDefaultSpecifier;
}

export function exportDefault(
  declaration: AST.ExportDefaultDeclarationKind,
): AST.ExportDefaultDeclaration {
  return {
    type: "ExportDefaultDeclaration",
    declaration,
    exportKind: "value",
    ...at,
  } as AST.ExportDefaultDeclaration;
}

export function exportNamed(declaration: AST.Declaration): AST.ExportNamedDeclaration {
  return {
    type: "ExportNamedDeclaration",
    declaration,
    specifiers: [],
    source: null,
    exportKind: "value",
    attributes: [],
    ...at,
  } as AST.ExportNamedDeclaration;
}

/** `export { local, local as alias, local as default };` */
export function exportList(local: string, names: readonly string[]): AST.ExportNamedDeclaration {
  return {
    type: "ExportNamedDeclaration",
    declaration: null,
    specifiers: names.map(
      (name) =>
        ({
          type: "ExportSpecifier",
          local: identifier(local),
          exported: identifier(name),
          exportKind: "value",
          ...at,
        }) as AST.ExportSpecifier,
    ),
    source: null,
    exportKind: "value",
    attributes: [],
    ...at,
  } as AST.ExportNamedDeclaration;
}

// --- Statements -----------------------------------------------------------------------------

export function blockStatement(body: AST.Statement[]): AST.BlockStatement {
  return { type: "BlockStatement", body, ...at } as AST.BlockStatement;
}

export function returnStatement(argument: AST.Expression | null): AST.ReturnStatement {
  return { type: "ReturnStatement", argument, ...at } as AST.ReturnStatement;
}

export function expressionStatement(expression: AST.Expression): AST.ExpressionStatement {
  return { type: "ExpressionStatement", expression, ...at } as AST.ExpressionStatement;
}

/**
 * `const name = init;`, or a pattern (`const { a, b } = init;`). A type annotation goes on a
 * named binding (`let props: Props = $props();`).
 */
export function variableDeclaration(
  kind: "const" | "let",
  name: string | AST.ObjectPattern,
  init: AST.Expression,
  typeAnnotation?: AST.TSType,
): AST.VariableDeclaration {
  const id = typeof name === "string" ? bindingIdentifier(name, typeAnnotation) : name;
  return {
    type: "VariableDeclaration",
    kind,
    declare: false,
    declarations: [{ type: "VariableDeclarator", id, init, definite: false, ...at }],
    ...at,
  } as AST.VariableDeclaration;
}

// --- Functions and calls --------------------------------------------------------------------

export function functionDeclaration(
  name: string,
  params: AST.ParamPattern[],
  body: AST.Statement[],
  options: { returnType?: AST.TSType } = {},
): AST.Function {
  return {
    type: "FunctionDeclaration",
    id: bindingIdentifier(name),
    generator: false,
    async: false,
    declare: false,
    params,
    body: blockStatement(body) as AST.FunctionBody,
    expression: false,
    typeParameters: null,
    returnType: options.returnType ? tsTypeAnnotation(options.returnType) : null,
    ...at,
  } as unknown as AST.Function;
}

export function arrowFunction(
  params: AST.ParamPattern[],
  body: AST.Statement[] | AST.Expression,
): AST.ArrowFunctionExpression {
  const expression = !Array.isArray(body);
  return {
    type: "ArrowFunctionExpression",
    id: null,
    generator: false,
    async: false,
    params,
    body: expression ? body : blockStatement(body),
    expression,
    typeParameters: null,
    returnType: null,
    ...at,
  } as unknown as AST.ArrowFunctionExpression;
}

/** A call, with type arguments when given (`component$<Props>(…)`, `input<string>()`). */
export function callExpression(
  callee: AST.Expression,
  args: AST.Argument[],
  typeArguments: readonly AST.TSType[] = [],
): AST.CallExpression {
  return {
    type: "CallExpression",
    callee,
    arguments: args,
    optional: false,
    typeArguments: typeArguments.length ? typeParameterInstantiation(typeArguments) : null,
    ...at,
  } as AST.CallExpression;
}

/** A rest parameter, `...parts: unknown[]`. */
export function restElement(name: string, typeAnnotation?: AST.TSType): AST.FormalParameterRest {
  return {
    type: "RestElement",
    argument: bindingIdentifier(name),
    decorators: [],
    optional: false,
    typeAnnotation: typeAnnotation ? tsTypeAnnotation(typeAnnotation) : null,
    value: null,
    ...at,
  } as AST.FormalParameterRest;
}

// --- Patterns -------------------------------------------------------------------------------

/**
 * An object pattern, `{ label, tone = "info" }: Props`: each property a shorthand binding,
 * with its default when given (see {@link bindingProperty}).
 */
export function objectPattern(
  properties: (AST.BindingProperty | AST.BindingRestElement)[],
  typeAnnotation?: AST.TSType,
): AST.ObjectPattern {
  return {
    type: "ObjectPattern",
    decorators: [],
    properties,
    optional: false,
    typeAnnotation: typeAnnotation ? tsTypeAnnotation(typeAnnotation) : null,
    ...at,
  } as AST.ObjectPattern;
}

/** A shorthand property of an object pattern, `name` or `name = defaultValue`. */
export function bindingProperty(name: string, defaultValue?: AST.Expression): AST.BindingProperty {
  return {
    type: "Property",
    kind: "init",
    key: identifier(name) as unknown as AST.IdentifierName,
    value: defaultValue
      ? assignmentPattern(bindingIdentifier(name), defaultValue)
      : bindingIdentifier(name),
    method: false,
    shorthand: true,
    computed: false,
    ...at,
  } as AST.BindingProperty;
}

/** `left = right`, a binding with a default. */
export function assignmentPattern(
  left: AST.BindingPattern,
  right: AST.Expression,
): AST.AssignmentPattern {
  return {
    type: "AssignmentPattern",
    decorators: [],
    left,
    right,
    optional: false,
    typeAnnotation: null,
    ...at,
  } as AST.AssignmentPattern;
}

// --- Expressions ----------------------------------------------------------------------------

/**
 * `object.member`, or `object["member"]` when the name is no identifier, or
 * `object[member]` for an expression. `optional` writes `?.`; the whole chain must then be
 * wrapped in {@link chainExpression}, once, around its outermost link.
 */
export function memberExpression(
  object: AST.Expression,
  member: string | AST.Expression,
  options: { optional?: boolean } = {},
): AST.MemberExpression {
  const computed = typeof member !== "string" || !isIdentifierName(member);
  return {
    type: "MemberExpression",
    object,
    property:
      typeof member !== "string" ? member : computed ? stringLiteral(member) : identifier(member),
    computed,
    optional: Boolean(options.optional),
    ...at,
  } as AST.MemberExpression;
}

/** An optional chain, around the outermost link of a chain holding `?.`. */
export function chainExpression(expression: AST.ChainElement): AST.ChainExpression {
  return { type: "ChainExpression", expression, ...at } as AST.ChainExpression;
}

export function conditionalExpression(
  test: AST.Expression,
  consequent: AST.Expression,
  alternate: AST.Expression,
): AST.ConditionalExpression {
  return { type: "ConditionalExpression", test, consequent, alternate, ...at };
}

export function logicalExpression(
  operator: AST.LogicalOperator,
  left: AST.Expression,
  right: AST.Expression,
): AST.LogicalExpression {
  return { type: "LogicalExpression", operator, left, right, ...at };
}

export function binaryExpression(
  operator: AST.BinaryOperator,
  left: AST.Expression,
  right: AST.Expression,
): AST.BinaryExpression {
  return { type: "BinaryExpression", operator, left, right, ...at } as AST.BinaryExpression;
}

export function unaryExpression(
  operator: AST.UnaryOperator,
  argument: AST.Expression,
): AST.UnaryExpression {
  return { type: "UnaryExpression", operator, prefix: true, argument, ...at };
}

export function arrayExpression(elements: AST.ArrayExpressionElement[]): AST.ArrayExpression {
  return { type: "ArrayExpression", elements, ...at } as AST.ArrayExpression;
}

export function spreadElement(argument: AST.Expression): AST.SpreadElement {
  return { type: "SpreadElement", argument, ...at };
}

/**
 * A property of an object literal: an identifier key when the name is one, a string key
 * otherwise (`"--gap"`, `"aria-label"`). `shorthand` writes `{ name }`.
 */
export function property(
  key: string,
  value: AST.Expression,
  options: { shorthand?: boolean } = {},
): AST.ObjectProperty {
  return {
    type: "Property",
    key: isIdentifierName(key) ? identifier(key) : stringLiteral(key),
    value,
    kind: "init",
    method: false,
    shorthand: Boolean(options.shorthand) && isIdentifierName(key),
    computed: false,
    ...at,
  } as AST.ObjectProperty;
}

/**
 * An object literal, from `[key, value]` pairs (see {@link property}) or built properties and
 * spreads.
 */
export function objectExpression(
  properties: ([key: string, value: AST.Expression] | AST.ObjectPropertyKind)[],
): AST.ObjectExpression {
  return {
    type: "ObjectExpression",
    properties: properties.map((entry) =>
      Array.isArray(entry) ? property(entry[0], entry[1]) : entry,
    ),
    ...at,
  } as AST.ObjectExpression;
}

/** `expression satisfies type`. */
export function satisfiesExpression(
  expression: AST.Expression,
  type: AST.TSType,
): AST.TSSatisfiesExpression {
  return { type: "TSSatisfiesExpression", expression, typeAnnotation: type, ...at };
}

/** `expression as type`. */
export function asExpression(expression: AST.Expression, type: AST.TSType): AST.TSAsExpression {
  return { type: "TSAsExpression", expression, typeAnnotation: type, ...at };
}

// --- Types ----------------------------------------------------------------------------------

export function tsTypeAnnotation(type: AST.TSType): AST.TSTypeAnnotation {
  return { type: "TSTypeAnnotation", typeAnnotation: type, ...at };
}

/** A reference to a named type, with type arguments when given (`Partial<Props>`). */
export function typeReference(
  name: string,
  typeArguments: readonly AST.TSType[] = [],
): AST.TSTypeReference {
  return {
    type: "TSTypeReference",
    typeName: identifier(name),
    typeArguments: typeArguments.length ? typeParameterInstantiation(typeArguments) : null,
    ...at,
  } as AST.TSTypeReference;
}

function typeParameterInstantiation(
  params: readonly AST.TSType[],
): AST.TSTypeParameterInstantiation {
  return { type: "TSTypeParameterInstantiation", params: [...params], ...at };
}

/** The keyword types a helper's signature needs. */
export type KeywordType =
  | "unknown"
  | "string"
  | "number"
  | "boolean"
  | "undefined"
  | "null"
  | "never"
  | "void";

const KEYWORD_TYPES = {
  unknown: "TSUnknownKeyword",
  string: "TSStringKeyword",
  number: "TSNumberKeyword",
  boolean: "TSBooleanKeyword",
  undefined: "TSUndefinedKeyword",
  null: "TSNullKeyword",
  never: "TSNeverKeyword",
  void: "TSVoidKeyword",
} as const satisfies Record<KeywordType, string>;

export function keywordType(keyword: KeywordType): AST.TSType {
  return { type: KEYWORD_TYPES[keyword], ...at } as AST.TSType;
}

/** `element[]`. */
export function arrayType(element: AST.TSType): AST.TSArrayType {
  return { type: "TSArrayType", elementType: element, ...at };
}

/** `a | b`. */
export function unionType(types: readonly AST.TSType[]): AST.TSUnionType {
  return { type: "TSUnionType", types: [...types], ...at };
}

// --- Classes --------------------------------------------------------------------------------

export function decorator(expression: AST.Expression): AST.Decorator {
  return { type: "Decorator", expression, ...at } as AST.Decorator;
}

export function classDeclaration(
  name: string,
  decorators: AST.Decorator[],
  body: AST.ClassElement[] = [],
): AST.Class {
  return {
    type: "ClassDeclaration",
    decorators,
    id: bindingIdentifier(name),
    typeParameters: null,
    superClass: null,
    superTypeArguments: null,
    implements: [],
    body: { type: "ClassBody", body, ...at },
    abstract: false,
    declare: false,
    ...at,
  } as AST.Class;
}

/**
 * A class field, `readonly label = input.required<string>();`, with its modifiers:
 * `protected readonly Math = Math;`.
 */
export function propertyDefinition(
  name: string,
  value: AST.Expression | null,
  options: {
    readonly?: boolean;
    static?: boolean;
    accessibility?: AST.TSAccessibility;
    typeAnnotation?: AST.TSType;
  } = {},
): AST.PropertyDefinition {
  return {
    type: "PropertyDefinition",
    decorators: [],
    key: identifier(name) as unknown as AST.IdentifierName,
    typeAnnotation: options.typeAnnotation ? tsTypeAnnotation(options.typeAnnotation) : null,
    value,
    computed: false,
    static: Boolean(options.static),
    declare: false,
    override: false,
    optional: false,
    definite: false,
    readonly: Boolean(options.readonly),
    accessibility: options.accessibility ?? null,
    ...at,
  };
}

// --- JSX ------------------------------------------------------------------------------------

/**
 * An element or attribute name: `div`, `Show`, a namespaced `bool:disabled`, or a member
 * `Foo.Bar`.
 */
export function jsxName(name: string): AST.JSXElementName {
  const namespaced = /^([^:.]+):([^:.]+)$/.exec(name);
  if (namespaced) {
    return {
      type: "JSXNamespacedName",
      namespace: jsxIdentifier(namespaced[1]!),
      name: jsxIdentifier(namespaced[2]!),
      ...at,
    };
  }
  const [first, ...rest] = name.split(".");
  return rest.reduce<AST.JSXElementName>(
    (object, part) =>
      ({
        type: "JSXMemberExpression",
        object,
        property: jsxIdentifier(part),
        ...at,
      }) as AST.JSXMemberExpression,
    jsxIdentifier(first!),
  );
}

function jsxIdentifier(name: string): AST.JSXIdentifier {
  return { type: "JSXIdentifier", name, ...at };
}

/** `name`, `name="value"` or `name={expression}`: a string value is quoted as given. */
export function jsxAttribute(
  name: string,
  value: AST.JSXAttributeValue | string | null = null,
): AST.JSXAttribute {
  return {
    type: "JSXAttribute",
    name: jsxName(name) as AST.JSXAttributeName,
    value:
      typeof value === "string"
        ? ({ type: "Literal", value, raw: `"${value}"`, ...at } as AST.StringLiteral)
        : value,
    ...at,
  };
}

/** `{...argument}` on an element. */
export function jsxSpreadAttribute(argument: AST.Expression): AST.JSXSpreadAttribute {
  return { type: "JSXSpreadAttribute", argument, ...at };
}

/** `{expression}`, as a child or an attribute value. */
export function jsxExpressionContainer(expression: AST.Expression): AST.JSXExpressionContainer {
  return { type: "JSXExpressionContainer", expression, ...at } as AST.JSXExpressionContainer;
}

/** An element, self-closing when it has no children. */
export function jsxElement(
  name: string,
  attributes: AST.JSXAttributeItem[] = [],
  children: AST.JSXChild[] = [],
): AST.JSXElement {
  const elementName = jsxName(name);
  const selfClosing = children.length === 0;
  return {
    type: "JSXElement",
    openingElement: {
      type: "JSXOpeningElement",
      name: elementName,
      attributes,
      selfClosing,
      typeArguments: null,
      ...at,
    },
    closingElement: selfClosing ? null : { type: "JSXClosingElement", name: elementName, ...at },
    children,
    ...at,
  };
}

/** `<>…</>`. */
export function jsxFragment(children: AST.JSXChild[]): AST.JSXFragment {
  return {
    type: "JSXFragment",
    openingFragment: { type: "JSXOpeningFragment", ...at },
    children,
    closingFragment: { type: "JSXClosingFragment", ...at },
    ...at,
  } as AST.JSXFragment;
}
