/** `HelloWorld` → `hello-world`; also splits acronyms: `HTMLView` → `html-view`. */
export function kebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** `hello-world` or `helloWorld` → `HelloWorld`. */
export function pascalCase(name: string): string {
  return name
    .replace(/[-_\s]+(.)?/g, (_, next: string | undefined) => (next ? next.toUpperCase() : ""))
    .replace(/^./, (first) => first.toUpperCase());
}
