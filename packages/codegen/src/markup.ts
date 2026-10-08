// The markup printer and its dialects (plan §5.8), under the names targets import: the generic
// printer in `markup/printer.ts`, one file per template language beside it.
export {
  classArrayItems,
  conjoin,
  member,
  negate,
  operand,
  printMarkup,
  staticClassValue,
  staticStyleValue,
  test,
  toggleObject,
  withoutEmptyBranches,
} from "./markup/printer.ts";
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
  PrintedEvent,
  PrintedRef,
  StylePart,
  TextPosition,
} from "./markup/printer.ts";
export { codeTokens, mapCode } from "./markup/escape.ts";
export type { CodeMap, CodeToken } from "./markup/escape.ts";
export { htmlDialect } from "./markup/html.ts";
export { vueAttributeCode, vueClassValue, vueDialect, vueInterpolationCode } from "./markup/vue.ts";
export { svelteDialect } from "./markup/svelte.ts";
export { angularCode, angularDialect } from "./markup/angular.ts";
export type { AngularContext } from "./markup/angular.ts";
export { astroDialect } from "./markup/astro.ts";
