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
export { printExpression, printModule, printProgram } from "./js/print.ts";
export { exportDeclaration, exportsOf } from "./exports.ts";
export { jsxElement, jsxText } from "./jsx.ts";
export type { JsxDialect } from "./jsx.ts";
export type { TextPosition } from "./markup.ts";
export {
  angularDialect,
  astroDialect,
  htmlDialect,
  printMarkup,
  svelteDialect,
  vueDialect,
} from "./markup.ts";
export type { LiteralRegion, MarkupDialect, MarkupOptions } from "./markup.ts";
export {
  BLOCK_ELEMENTS,
  BOOLEAN_ATTRIBUTES,
  isBlockElement,
  isBooleanAttribute,
  isVoidElement,
  VOID_ELEMENTS,
  WHITESPACE_PRESERVING_ELEMENTS,
} from "./html.ts";
export { formatOutput, isFormatted, OUTPUT_FORMAT } from "./format.ts";
export type { FormatOutcome } from "./format.ts";
export { ImportSet } from "./imports.ts";
export { kebabCase, pascalCase } from "./names.ts";
export type { Diagnostic, DiagnosticCode } from "@unframework/diagnostics";
export type * from "./toolchain.ts";
