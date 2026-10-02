export type {
  Attribute,
  ElementNode,
  RenderNode,
  Span,
  StaticAttribute,
  TextNode,
  UfComponent,
  UfExport,
  UfModule,
} from "./types.ts";
export { IR_VERSION } from "./version.ts";
export {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
  span,
} from "./builders.ts";
export { ATTRIBUTE_KINDS, RENDER_NODE_KINDS, collectFeatures, walk } from "./visit.ts";
export type { ModuleFeatures, Visitor } from "./visit.ts";
export { irSchema } from "./schema.ts";
export type { JsonSchema } from "./schema.ts";
export { validateModule } from "./validate.ts";
export type { IrValidationError } from "./validate.ts";
export { checkInvariants } from "./invariants.ts";
export { isComponentName, isExportName } from "./names.ts";
export { listBoxSize } from "./listbox.ts";
export {
  CHILDLESS_ATTRIBUTES,
  FIXED_VALUE_INPUT_TYPES,
  isDroppedEmptyUrl,
  isStateAttribute,
  isWhitespaceText,
  STATE_ATTRIBUTES,
  TEMPLATE_SYNTAX_ATTRIBUTES,
  UNPORTABLE_ELEMENTS,
  UNRENDERED_ATTRIBUTES,
  WHITESPACE_DROPPING_ELEMENTS,
} from "./portability.ts";
export {
  ARIA_ATTRIBUTES,
  BLOCK_ELEMENTS,
  BOOLEAN_ATTRIBUTES,
  canonicalNumber,
  DOCUMENT_ATTRIBUTES,
  ELEMENT_ATTRIBUTES,
  GENERATED_ID_PREFIX,
  GLOBAL_ATTRIBUTES,
  HEADING_ELEMENTS,
  HTML_ELEMENTS,
  ID_REFERENCE_ATTRIBUTES,
  idReferencesIn,
  isBlockElement,
  isBooleanAttribute,
  isDataAttribute,
  isHtmlAttribute,
  isHtmlElement,
  isJavaScriptUrl,
  isVoidElement,
  NESTED_DOCUMENT_ATTRIBUTES,
  NUMERIC_ATTRIBUTES,
  OBSOLETE_ELEMENTS,
  P_CLOSING_ELEMENTS,
  PERMITTED_CHILDREN,
  REPAIRED_DESCENDANTS,
  replaceIdReferences,
  REQUIRED_PARENTS,
  TEXT_ONLY_ELEMENTS,
  TEXTLESS_ELEMENTS,
  TRUE_VALUED_ATTRIBUTES,
  unanalysableUrl,
  unkeptCharacter,
  UNRENDERABLE_ELEMENTS,
  URL_ATTRIBUTES,
  VOID_ELEMENTS,
  WHITESPACE_PRESERVING_ELEMENTS,
} from "./html.ts";
export type { NumberKind, UnkeptCharacter } from "./html.ts";
