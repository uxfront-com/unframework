export {
  BEHAVIOURAL_CAPABILITIES,
  CAPABILITY_NAMES,
  CAPABILITY_PREREQUISITES,
  defineTarget,
} from "./target.ts";
export { compositionUse, requiredCapabilities } from "./capabilities.ts";
export { eventCalls, handedControls, handlerControls, ownControls } from "./controls.ts";
export type { ControlTest, EventCall, HandlerControls, LiftedControl } from "./controls.ts";
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
export { isAlwaysNullish, nullishText, syntacticNullishness, textTemplate } from "./js/text.ts";
export type { Nullishness, TextPart } from "./js/text.ts";
export { componentTypes, exportDeclaration, exportsOf, typeDeclarationCode } from "./exports.ts";
export {
  bindingOf,
  codeKind,
  codeNames,
  expressionNames,
  needsParentheses,
  parenthesesNeeded,
  rewriteCode,
  rewriteExpression,
  writtenValue,
} from "./rewrite.ts";
export type {
  EmitParts,
  ParenthesesSlot,
  RewriteRules,
  RewriteSite,
  WriteParts,
} from "./rewrite.ts";
export {
  parseCodeSource,
  parseExpression,
  parseExpressionSource,
  parseStatementsSource,
} from "./parse.ts";
export type { CodeKind, ExpressionComment, ParsedExpression, ParsedStatements } from "./parse.ts";
export { liveBindings, liveTypes, referencedBindings } from "./references.ts";
export type { LiveOptions, ReferencedOptions } from "./references.ts";
export {
  functionBodyText,
  functionSource,
  functionText,
  handlerText,
  parametersText,
  parameterText,
} from "./functions.ts";
export type { FunctionTextOptions } from "./functions.ts";
export {
  boundJsxAttribute,
  classArrayItems,
  classJsxAttribute,
  eventJsxAttribute,
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
  jsxHandler,
  jsxNode,
  jsxText,
  listParameters,
  mapCall,
  refJsxAttribute,
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
  angularCode,
  angularDialect,
  astroDialect,
  codeTokens,
  conjoin,
  htmlDialect,
  mapCode,
  member,
  negate,
  operand,
  printMarkup,
  svelteDialect,
  test,
  vueAttributeCode,
  vueDialect,
} from "./markup.ts";
export type {
  AngularContext,
  AttributeContext,
  BlockSegment,
  ClassPart,
  CodeMap,
  CodeToken,
  ConditionalBranch,
  Container,
  ListParts,
  LiteralRegion,
  MarkupDialect,
  MarkupOptions,
  MarkupPiece,
  PrintedAttribute,
  PrintedEvent,
  PrintedRef,
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
export { childImports, ImportSet } from "./imports.ts";
export type { ChildImport } from "./imports.ts";
export { isPrimitiveState } from "./kinds.ts";
export { kebabCase, NameScope, pascalCase, sourceNames, typeNames } from "./names.ts";
export type { Diagnostic, DiagnosticCode } from "@unframework/diagnostics";
export type * from "./toolchain.ts";
