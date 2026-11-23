import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface DrinksSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["fieldset"];
}

export default class Drinks extends Component<DrinksSignature> {
  @tracked drinks: string[] = ["tea"];

  get value1() {
    return this.drinks.includes("tea");
  }

  listener1 = (event: Event) => {
    this.drinks = toggle(this.drinks, "tea", (event.currentTarget as HTMLInputElement).checked);
  };

  get value2() {
    return this.drinks.includes("coffee");
  }

  listener2 = (event: Event) => {
    this.drinks = toggle(this.drinks, "coffee", (event.currentTarget as HTMLInputElement).checked);
  };

  get value3() {
    return this.drinks.includes("juice");
  }

  listener3 = (event: Event) => {
    this.drinks = toggle(this.drinks, "juice", (event.currentTarget as HTMLInputElement).checked);
  };

  get value4() {
    return this.drinks.join(", ") || "nothing";
  }

  listener4 = () => (this.drinks = ["juice"]);

  <template><fieldset
      style={{fallthroughStyle @style}}
      ...attributes
    ><legend>Drinks</legend><label><input
      type="checkbox"
      value="tea"
      checked={{this.value1}}
      {{on "change" this.listener1}}
    > Tea</label><label><input
      type="checkbox"
      value="coffee"
      checked={{this.value2}}
      {{on "change" this.listener2}}
    > Coffee</label><label><input
      type="checkbox"
      value="juice"
      checked={{this.value3}}
      {{on "change" this.listener3}}
    > Juice</label><output>Ordered: {{this.value4}}</output><button
      type="button"
      {{on "click" this.listener4}}
    >Only juice</button></fieldset></template>
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

/** The values with `value` added when `checked`, and removed otherwise. */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  return checked ? values.concat([value]) : values.filter((each) => each !== value);
}
