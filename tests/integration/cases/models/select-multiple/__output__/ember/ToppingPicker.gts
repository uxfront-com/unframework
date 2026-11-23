import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface ToppingPickerSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class ToppingPicker extends Component<ToppingPickerSignature> {
  @tracked toppings: string[] = ["cheese"];

  get value1() {
    return this.toppings.includes("cheese");
  }

  get value2() {
    return this.toppings.includes("olives");
  }

  get value3() {
    return this.toppings.includes("basil");
  }

  listener1 = (event: Event) => {
    this.toppings = Array.from(
      (event.currentTarget as HTMLSelectElement).selectedOptions,
      (option) => option.value,
    );
  };

  get value4() {
    return this.toppings.join(", ") || "nothing";
  }

  listener2 = () => (this.toppings = ["basil", "olives"]);

  <template><section
      aria-label="Pizza"
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Toppings <select
      multiple
      {{on "change" this.listener1}}
    ><option value="cheese" selected={{this.value1}}>Cheese</option><option
      value="olives" selected={{this.value2}}
    >Olives</option><option value="basil" selected={{this.value3}}>Basil</option></select></label><output>On top: {{this.value4}}</output><button
      type="button"
      {{on "click" this.listener2}}
    >Green</button></section></template>
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
