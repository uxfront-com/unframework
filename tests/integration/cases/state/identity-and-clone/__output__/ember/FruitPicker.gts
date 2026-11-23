import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface Fruit {
  name: string;
  colour: string;
}

export interface FruitPickerProps {
  fruits: Fruit[];
}

export interface FruitPickerEvents {
  onKept?: (name: string, colour: string) => void;
}

export interface FruitPickerSignature {
  Args: FruitPickerProps & { style?: unknown } & FruitPickerEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class FruitPicker extends Component<FruitPickerSignature> {
  pick = (fruit: Fruit) => {
    this.selected = fruit;
  };

  keep = () => {
    const current = this.selected;
    if (!current) return;
    const copy = structuredClone(current);
    this.basket = [...this.basket, copy];
    this.args.onKept?.(copy.name, copy.colour);
  };

  @tracked selected: Fruit | null = null;

  @tracked basket: Fruit[] = [];

  value1 = (fruit: NonNullable<this["args"]["fruits"]>[number]) => fruit === this.selected;

  listener1 = (fruit: NonNullable<this["args"]["fruits"]>[number]) => () => this.pick(fruit);

  value2 = (fruit: NonNullable<this["basket"]>[number]) => `${fruit.name} (${fruit.colour})`;

  <template><section
      class="fruit-picker"
      aria-label="Fruit"
      style={{fallthroughStyle @style}}
      ...attributes
    ><ul
      aria-label="Fruits"
    >{{#each @fruits key="name" as |fruit|}}<li><button
      type="button"
      aria-pressed={{enumeratedValue (this.value1 fruit)}}
      {{on "click" (this.listener1 fruit)}}
    >{{fruit.name}}</button></li>{{/each}}</ul><button
      type="button"
      {{on "click" this.keep}}
    >Keep a copy</button><ol
      aria-label="Basket"
    >{{#each this.basket key="@index" as |fruit|}}<li>{{this.value2 fruit}}</li>{{/each}}</ol></section></template>
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
