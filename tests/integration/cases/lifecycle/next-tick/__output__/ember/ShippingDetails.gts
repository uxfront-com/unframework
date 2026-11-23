import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { capabilities, setModifierManager } from "@ember/modifier";
import { renderSettled } from "@ember/renderer";
import type { ModifierLike } from "@glint/template";

export interface ShippingDetailsEvents {
  onToggled?: (items: number) => void;
}

export interface ShippingDetailsSignature {
  Args: { style?: unknown } & ShippingDetailsEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class ShippingDetails extends Component<ShippingDetailsSignature> {
  toggle = async () => {
    this.open = !this.open;
    await renderSettled();
    this.args.onToggled?.(this.details?.childElementCount ?? 0);
  };

  @tracked open = false;

  @tracked details: HTMLUListElement | null = null;

  <template><section
      class="shipping-details"
      aria-label="Shipping"
      style={{fallthroughStyle @style}}
      ...attributes
    ><button
      type="button"
      aria-expanded={{enumeratedValue this.open}}
      {{on "click" this.toggle}}
    >Shipping details</button>{{#if this.open}}<ul
      {{templateRef this "details"}}
    ><li>Ships in two days</li><li>Free returns</li><li>Tracked delivery</li></ul>{{/if}}</section></template>
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
