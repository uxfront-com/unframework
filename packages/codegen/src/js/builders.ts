// Builders for the ESTree (TS-ESTree) nodes that targets synthesise. Synthesised code is
// built as AST and printed with oxc-codegen (plan §5.4), never glued from strings.
import type * as AST from "@oxc-project/types";

const at = { start: 0, end: 0 } as const;

export function identifier(name: string): AST.IdentifierReference {
  return { type: "Identifier", name, ...at } as AST.IdentifierReference;
}

export function bindingIdentifier(name: string): AST.BindingIdentifier {
  return { type: "Identifier", name, ...at } as AST.BindingIdentifier;
}

export function stringLiteral(value: string): AST.StringLiteral {
  return { type: "Literal", value, raw: JSON.stringify(value), ...at } as AST.StringLiteral;
}

export function booleanLiteral(value: boolean): AST.BooleanLiteral {
  return { type: "Literal", value, raw: String(value), ...at } as AST.BooleanLiteral;
}

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

export function blockStatement(body: AST.Statement[]): AST.BlockStatement {
  return { type: "BlockStatement", body, ...at } as AST.BlockStatement;
}

export function returnStatement(argument: AST.Expression | null): AST.ReturnStatement {
  return { type: "ReturnStatement", argument, ...at } as AST.ReturnStatement;
}

export function expressionStatement(expression: AST.Expression): AST.ExpressionStatement {
  return { type: "ExpressionStatement", expression, ...at } as AST.ExpressionStatement;
}

export function functionDeclaration(
  name: string,
  params: AST.ParamPattern[],
  body: AST.Statement[],
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
    returnType: null,
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

export function callExpression(callee: AST.Expression, args: AST.Argument[]): AST.CallExpression {
  return {
    type: "CallExpression",
    callee,
    arguments: args,
    optional: false,
    typeArguments: null,
    ...at,
  } as AST.CallExpression;
}

export function objectExpression(
  properties: [key: string, value: AST.Expression][],
): AST.ObjectExpression {
  return {
    type: "ObjectExpression",
    properties: properties.map(
      ([key, value]) =>
        ({
          type: "Property",
          key: /^[A-Za-z_$][\w$]*$/.test(key) ? identifier(key) : stringLiteral(key),
          value,
          kind: "init",
          method: false,
          shorthand: false,
          computed: false,
          ...at,
        }) as AST.ObjectProperty,
    ),
    ...at,
  } as AST.ObjectExpression;
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

export function variableDeclaration(
  kind: "const" | "let",
  name: string,
  init: AST.Expression,
): AST.VariableDeclaration {
  return {
    type: "VariableDeclaration",
    kind,
    declare: false,
    declarations: [
      { type: "VariableDeclarator", id: bindingIdentifier(name), init, definite: false, ...at },
    ],
    ...at,
  } as AST.VariableDeclaration;
}
