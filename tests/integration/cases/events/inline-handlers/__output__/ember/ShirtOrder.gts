import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { capabilities, setModifierManager } from "@ember/modifier";
import type { ModifierLike } from "@glint/template";

export interface ShirtOrderSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class ShirtOrder extends Component<ShirtOrderSignature> {
  @tracked size = "M";

  @tracked quantity = 1;

  @tracked note = "";

  @tracked noteField: HTMLInputElement | null = null;

  get value1() {
    return `${this.quantity} x size ${this.size}`;
  }

  get value2() {
    return this.size === "S";
  }

  listener1 = (event: HTMLElementEventMap["click"]) =>
    (this.size = (event.currentTarget as HTMLButtonElement).value);

  get value3() {
    return this.size === "M";
  }

  get value4() {
    return this.size === "L";
  }

  listener2 = () => this.quantity++;

  listener3 = (event: HTMLElementEventMap["input"]) =>
    (this.note = (event.currentTarget as HTMLInputElement).value);

  listener4 = () => {
    this.quantity = 1;
    this.size = "M";
    this.note = "";
    const input = this.noteField;
    if (input) input.value = "";
  };

  <template><section
      class="shirt-order"
      aria-label="Shirt order"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p role="status">{{this.value1}}</p><div
      role="group"
      aria-label="Size"
    ><button
      type="button"
      value="S"
      aria-pressed={{enumeratedValue this.value2}}
      {{on "click" this.listener1}}
    >Small</button><button
      type="button"
      value="M"
      aria-pressed={{enumeratedValue this.value3}}
      {{on "click" this.listener1}}
    >Medium</button><button
      type="button"
      value="L"
      aria-pressed={{enumeratedValue this.value4}}
      {{on "click" this.listener1}}
    >Large</button></div><button type="button" {{on "click" this.listener2}}>Add one</button><label>Note<input
      name="note"
      {{templateRef this "noteField"}}
      {{on "input" this.listener3}}
    ></label><p>Note: {{this.note}}</p><button
      type="button"
      {{on "click" this.listener4}}
    >Reset</button></section></template>
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

/** A modifier that sets a member of its component to its element while the element is rendered. */
const templateRef = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: () => ({}),
    installModifier(
      _state: object,
      element: Element,
      { positional }: { positional: readonly unknown[] },
    ) {
      Reflect.set(positional[0] as object, positional[1] as string, element);
    },
    updateModifier() {},
    destroyModifier(_state: object, { positional }: { positional: readonly unknown[] }) {
      Reflect.set(positional[0] as object, positional[1] as string, null);
    },
  }),
  {},
) as unknown as ModifierLike<{
  Element: Element;
  Args: { Positional: [owner: object, name: string] };
}>;
