// The HTML vocabulary lives in @unframework/ir, which every layer shares; the target kit
// re-exports it for targets, which import only ir and codegen.
export {
  BLOCK_ELEMENTS,
  BOOLEAN_ATTRIBUTES,
  isBlockElement,
  isBooleanAttribute,
  isVoidElement,
  VOID_ELEMENTS,
  WHITESPACE_PRESERVING_ELEMENTS,
} from "@unframework/ir";
