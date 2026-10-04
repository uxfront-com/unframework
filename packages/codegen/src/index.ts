export { CAPABILITY_NAMES, defineTarget } from "./target.ts";
export { requiredCapabilities } from "./capabilities.ts";
export type {
  Capabilities,
  CapabilityCell,
  CapabilityName,
  EmitContext,
  OutputFile,
  Target,
} from "./target.ts";
export * as js from "./js/builders.ts";
export type { KeywordType } from "./js/builders.ts";
export { printComponentModule, printExpression, printModule, printProgram } from "./js/print.ts";
export type { ComponentModule } from "./js/print.ts";
export { Placeholders } from "./js/placeholders.ts";
export { componentTypes, exportDeclaration, exportsOf, typeDeclarationCode } from "./exports.ts";
export {
  bindingOf,
  expressionNames,
  needsParentheses,
  parenthesesNeeded,
  parseExpression,
  parseExpressionSource,
  referencedBindings,
  rewriteExpression,
} from "./rewrite.ts";
export type {
  ExpressionComment,
  ParenthesesSlot,
  ParsedExpression,
  ReferencedOptions,
  RewriteRules,
} from "./rewrite.ts";
export {
  boundJsxAttribute,
  classArrayItems,
  classJsxAttribute,
  expressionCode,
  jsxAttributeName,
  jsxAttributes,
  jsxAttributeValue,
  jsxBinding,
  jsxBranch,
  jsxChildren,
  jsxContext,
  jsxElement,
  jsxExpression,
  jsxNode,
  jsxText,
  listParameters,
  mapCall,
  mayBeAbsent,
  spreadClassReads,
  spreadJsxAttributes,
  spreadRead,
  staticJsxAttribute,
  styleJsxAttribute,
  styleKey,
  styleObject,
  ternaryChain,
} from "./jsx.ts";
export type { JsxContext, JsxContextOptions, JsxDialect } from "./jsx.ts";
export type { TextPosition } from "./markup.ts";
export {
  angularDialect,
  astroDialect,
  htmlDialect,
  printMarkup,
  svelteDialect,
  vueDialect,
} from "./markup.ts";
export type {
  AttributeContext,
  BlockSegment,
  ClassPart,
  ConditionalBranch,
  Container,
  ListParts,
  LiteralRegion,
  MarkupDialect,
  MarkupOptions,
  MarkupPiece,
  PrintedAttribute,
  StylePart,
} from "./markup.ts";
export {
  ALLOWED_GLOBALS,
  ARIA_ATTRIBUTES,
  BINDABLE_BOOLEAN_ATTRIBUTES,
  BLOCK_ELEMENTS,
  BOOLEAN_ATTRIBUTES,
  canonicalNumber,
  elementNamespace,
  isBlockElement,
  isBooleanAttribute,
  isCustomProperty,
  isDataAttribute,
  isIdentifier,
  isNumberTypedAttribute,
  isSvgElement,
  isVoidElement,
  LEADING_LINE_FEED_ELEMENTS,
  NUMBER_TYPED_ATTRIBUTES,
  NUMBER_TYPED_GLOBAL_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_TEXT_ELEMENTS,
  TEXTLESS_ELEMENTS,
  TRUE_VALUED_ATTRIBUTES,
  UNINTERPOLATED_ELEMENTS,
  UNITLESS_PROPERTIES,
  URL_ATTRIBUTES,
  VOID_ELEMENTS,
  WHITESPACE_PRESERVING_ELEMENTS,
} from "./html.ts";
export type { Namespace } from "./html.ts";
export { formatOutput, isFormatted, OUTPUT_FORMAT } from "./format.ts";
export type { FormatOutcome } from "./format.ts";
export { ImportSet } from "./imports.ts";
export { kebabCase, NameScope, pascalCase, sourceNames } from "./names.ts";
export type { Diagnostic, DiagnosticCode } from "@unframework/diagnostics";
export type * from "./toolchain.ts";
