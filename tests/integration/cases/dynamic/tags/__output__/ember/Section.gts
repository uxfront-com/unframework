import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface SectionSignature {
  Args: { title: string } & { style?: unknown };
  Element: HTMLElementTagNameMap["article"];
}

export default class Section extends Component<SectionSignature> {
  @tracked nested = false;

  get value1() {
    return this.nested ? "h3" : "h2";
  }

  get value2() {
    return this.nested ? "Lift" : "Nest";
  }

  listener1 = () => (this.nested = !this.nested);

  <template><article
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#if (eq this.value1 "h3")}}<h3 class="title">{{@title}}</h3>{{else}}<h2
      class="title"
    >{{@title}}</h2>{{/if}}<button
      type="button"
      {{on "click" this.listener1}}
    >{{this.value2}}</button></article></template>
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
