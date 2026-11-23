import Component from "@glimmer/component";
import { cached } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import Badge from "./Badge.gts";

export interface Theme {
  accent: string;
  label: string;
}

export const ThemeKey = Symbol("uf.theme");

export interface ThemeProviderSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class ThemeProvider extends Component<ThemeProviderSignature> {
  @cached
  get providerMarker(): Text {
    return provider([[ThemeKey, { accent: "teal", label: "Teal" }]]);
  }

  <template><section
      aria-label="Themed"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{this.providerMarker}}<Badge @text="New" /></section></template>
}

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}

/**
 * Vue's `provide`: a text node, first in the component's root, that holds each provided value
 * under its key. The root's descendants find it, and no sibling of the root does (`inject`).
 */
function provider(entries: readonly (readonly [symbol, unknown])[]): Text {
  const marker = document.createTextNode("");
  for (const [key, value] of entries) Reflect.set(marker, key, value);
  return marker;
}
