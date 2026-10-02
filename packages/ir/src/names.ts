/**
 * Whether a name can be a component's: PascalCase, in ASCII letters and digits, as the parser
 * finds components. Every target writes it as an identifier and names the output file by it
 * (`Card.vue`, `card.ts`), so nothing else is both.
 */
export function isComponentName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

/**
 * Whether a name can be exported: `default`, or an ECMAScript IdentifierName, which a consumer
 * can import and use as a tag.
 */
export function isExportName(name: string): boolean {
  return name === "default" || /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$/u.test(name);
}
