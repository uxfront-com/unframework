import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface BaseEvents {
  onPress?: () => void;
}

export interface BaseSignature {
  Args: { href?: string; disabled?: boolean; text: string } & { style?: unknown } & BaseEvents;
  Element: HTMLElementTagNameMap["a"] | HTMLElementTagNameMap["button"];
}

export default class Base extends Component<BaseSignature> {
  press = (event: MouseEvent) => {
    event.preventDefault();
    this.args.onPress?.();
  };

  get value1() {
    return this.args.href ? "a" : "button";
  }

  <template>{{#if (eq this.value1 "a")}}<a
      href={{@href}}
      class="base"
      style={{fallthroughStyle "padding: 4px 8px" @style}}
      {{on "click" this.press}}
      ...attributes
    >{{@text}}</a>{{else}}<button
      disabled={{@disabled}}
      class="base"
      style={{fallthroughStyle "padding: 4px 8px" @style}}
      {{on "click" this.press}}
      ...attributes
    >{{@text}}</button>{{/if}}</template>
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
