import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface SizePickerSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class SizePicker extends Component<SizePickerSignature> {
  @tracked size = "m";

  get value1() {
    return String(this.size) === "s";
  }

  get value2() {
    return String(this.size) === "m";
  }

  get value3() {
    return String(this.size) === "l";
  }

  listener1 = (event: Event) => {
    this.size = (event.currentTarget as HTMLSelectElement).value;
  };

  listener2 = () => (this.size = "l");

  <template><section
      aria-label="Size"
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Size <select
      {{on "change" this.listener1}}
    ><option value="s" selected={{this.value1}}>Small</option><option
      value="m" selected={{this.value2}}
    >Medium</option><option value="l" selected={{this.value3}}>Large</option></select></label><output>Chosen: {{this.size}}</output><button
      type="button"
      {{on "click" this.listener2}}
    >Largest</button></section></template>
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
