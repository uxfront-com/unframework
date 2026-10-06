export { parseModule } from "./parse.ts";
export type { ParseError, ParsedModule, Span } from "./parse.ts";
export { findComponents, isComponentName } from "./components.ts";
export { exportName } from "./early-errors.ts";
export type { ComponentDeclaration, ComponentExport } from "./components.ts";
export { parseStylesheet } from "./stylesheet.ts";
export type { ParsedStylesheet } from "./stylesheet.ts";
export { parseDeclarations } from "./style.ts";
export type { CssDeclaration, ParsedDeclarations } from "./style.ts";
export { findTypeDeclarations, typeDeclarationOf } from "./declarations.ts";
export type { TypeDeclarationStatement } from "./declarations.ts";
// oxc's child keys for every node type, so a pass can walk the AST without importing oxc.
export { visitorKeys } from "oxc-parser";
export type * as AST from "oxc-parser";
