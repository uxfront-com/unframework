import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export interface TagSignature {
  Args: TagProps & { style?: unknown };
  Element: HTMLElementTagNameMap["span"];
}

export default class Tag extends Component<TagSignature> {
  get value1() {
    return [
      ["display", "inline-block"] as const,
      ["padding", "2px 8px"] as const,
      ["border-style", "solid"] as const,
      ["border-width", "1px"] as const,
      ["border-color", this.args.colour ?? "#5a5a5a"] as const,
      ["color", this.args.colour] as const,
      ["font-weight", this.args.weight] as const,
      ["margin-left", this.args.indent] as const,
    ];
  }

  <template><span class="tag" style={{fallthroughStyle this.value1 @style}} ...attributes>{{@label}}</span></template>
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
