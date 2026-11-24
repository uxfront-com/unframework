// Qwik's helpers for emulated capabilities (ADR-0033) that it shares in the output tree's
// `_unframework/` (ADR-0121), or prints inline where the emit has no shared modules: each printer
// takes the helper's name, so the shared module and the inline copy are one text.

/**
 * `child-root-scope`: the scope attributes a component's styled parents pass it (ADR-0063),
 * which its root carries. Their names are the parents' ids, which the component cannot know, so
 * it picks the props' `data-uf-*` keys by name, each with the empty value the parent passes: a
 * rest spread alone would also pass on the props the output leaves unread.
 */
export function scopeAttributesHelper(name: string): string {
  return `/** The scope attributes of the styled parents that render this component, for its root. */
function ${name}(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}`;
}

/**
 * `styleObject`: a style bound to a value as an object, where an object spread merges it
 * (ADR-0065). Raw, so the regular expressions keep their escapes.
 */
export function styleObjectHelper(name: string): string {
  return String.raw`/**
 * A style bound to a value as an object, which a merge spreads: a declaration list splits as
 * Vue's parseStringStyle splits it, with camel-case keys.
 */
function ${name}(style: object | string | null | undefined): Record<string, string> {
  if (typeof style !== "string") return { ...style };
  const object: Record<string, string> = {};
  for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
    const [property, value] = declaration.split(/:([^]+)/);
    const key = property!.trim();
    // A property is a custom property or a CSS identifier: anything else would reach the markup.
    if (value === undefined || !/^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/.test(key)) continue;
    // A standard name is case-insensitive, as the browser reads it: COLOR is color.
    const camel = key.toLowerCase().replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    object[key.startsWith("--") ? key : camel] = value.trim();
  }
  return object;
}`;
}

/** `nextTick`: Qwik has none, so a promise resolves once it has rendered (ADR-0033). */
export function nextTickHelper(name: string): string {
  return [
    "/**",
    " * Resolves once Qwik has rendered the writes made before it: Qwik renders them in a microtask,",
    " * so they are in the DOM by the next task.",
    " */",
    `function ${name}(): Promise<void> {`,
    "  return new Promise((resolve) => setTimeout(resolve));",
    "}",
  ].join("\n");
}

/** `modelText`: a text control's `v-model` modifiers and cast, as Vue's `vModelText` (ADR-0054). */
export function modelTextHelper(name: string, modifiers: string): string {
  return [
    "/**",
    " * A text control's `v-model` as Vue's `vModelText` runs it: `read` is what the control's text",
    " * writes, trimmed with `trim` and cast with `number` as `looseToNumber` does; `shown` is the text",
    " * the control shows for a value, which keeps the person's own text while it is focused and",
    " * reads as the value (`trim`, `lazy`), or casts to it.",
    " */",
    `const ${name} = {`,
    `  read<T>(element: HTMLInputElement | HTMLTextAreaElement, modifiers: ${modifiers}): T {`,
    "    const text = modifiers.trim ? element.value.trim() : element.value;",
    "    const number = Number.parseFloat(text);",
    "    // The state's type: where the text is no number, Vue writes the text, as here.",
    "    return (modifiers.number && !Number.isNaN(number) ? number : text) as T;",
    "  },",
    "  shown(",
    "    element: HTMLInputElement | HTMLTextAreaElement | undefined,",
    "    value: unknown,",
    `    modifiers: ${modifiers},`,
    "  ): string {",
    '    const text = value == null ? "" : String(value);',
    "    if (!element || element.value === text) return text;",
    '    if (element === document.activeElement && element.type !== "range") {',
    "      if (modifiers.lazy || (modifiers.trim && element.value.trim() === text)) {",
    "        return element.value;",
    "      }",
    "    }",
    "    if (modifiers.number && this.read(element, modifiers) === value) return element.value;",
    "    return text;",
    "  },",
    "};",
    "",
    "/** The modifiers of a text control's `v-model`. */",
    `interface ${modifiers} {`,
    "  trim?: boolean;",
    "  lazy?: boolean;",
    "  number?: boolean;",
    "}",
  ].join("\n");
}
