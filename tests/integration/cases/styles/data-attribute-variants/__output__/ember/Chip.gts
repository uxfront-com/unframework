import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import "./Chip.uf.tsx.css";

export interface ChipSignature {
  Args: { label: string; variant?: "neutral" | "danger"; pressed?: boolean } & { style?: unknown };
  Element: HTMLElementTagNameMap["button"];
}

export default class Chip extends Component<ChipSignature> {
  get variant() {
    return this.args.variant === undefined ? "neutral" : this.args.variant;
  }

  get pressed() {
    return this.args.pressed === undefined ? false : this.args.pressed;
  }

  get value1() {
    return this.pressed ? "on" : "off";
  }

  get value2() {
    return this.pressed ? "true" : "false";
  }

  <template><button
      type="button"
      class="chip"
      data-variant={{this.variant}}
      data-state={{this.value1}}
      aria-pressed={{enumeratedValue this.value2}}
      data-uf-69db3802=""
      style={{fallthroughStyle @style}}
      ...attributes
    >{{@label}}</button></template>
}

/** An enumerated attribute's value: a boolean as its name, any other value as it is. */
function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
  return typeof value === "boolean"
    ? (String(value) as "true" | "false")
    : (value as Exclude<T, boolean>);
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
