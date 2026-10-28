import type { BrowserEngine } from "../../harness.ts";
import { parseStyle, printStyle } from "../style.ts";
import { attributeName, forEachElement } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/**
 * The properties an engine serialises under its own alias, by engine: each alias and the name
 * Chromium, which writes every committed expectation, serialises. Only an alias that names the
 * same property is listed, so a value still compares as it is.
 */
const ENGINE_ALIASES: Readonly<Partial<Record<BrowserEngine, Readonly<Record<string, string>>>>> = {
  // Firefox parses `-webkit-box-orient` as an alias of its own property, and `style.cssText`
  // writes the property's name.
  firefox: { "-moz-box-orient": "-webkit-box-orient" },
};

/**
 * Rule 3b: renames, in every `style` attribute, the properties the engine the DOM was read in
 * serialises under its own alias (ADR-0067, amending ADR-0031). The engine renders the source's
 * property (L8 checks it), but its `cssText` spells it another way, so a Firefox DOM never
 * matched an expectation Chromium wrote. Only the named engine's aliases are renamed, and only
 * the property: a value that differs still differs, and so does every other `-moz-*` property.
 * It runs before rule 4a, which sorts the declarations by their names.
 */
export function renameEngineAliases(root: TreeParent, engine?: BrowserEngine): void {
  const aliases = engine === undefined ? undefined : ENGINE_ALIASES[engine];
  if (!aliases) return;
  forEachElement(root, (element) => {
    for (const attribute of element.attrs) {
      if (attributeName(attribute) !== "style") continue;
      const declarations = parseStyle(attribute.value);
      if (!declarations.some((declaration) => Object.hasOwn(aliases, declaration.property))) {
        continue;
      }
      attribute.value = printStyle(
        declarations.map((declaration) =>
          Object.hasOwn(aliases, declaration.property)
            ? { ...declaration, property: aliases[declaration.property]! }
            : declaration,
        ),
      );
    }
  });
}
