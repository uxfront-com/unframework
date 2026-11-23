import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export interface QuantityStepperSignature {
  Args: QuantityStepperProps & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

export default class QuantityStepper extends Component<QuantityStepperSignature> {
  @tracked quantity = this.args.initial;

  get value1() {
    return `Increase ${this.args.label}`;
  }

  listener1 = () => this.quantity++;

  <template><div
      class="quantity-stepper"
      role="group"
      aria-label={{@label}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><output>{{this.quantity}}</output><button
      type="button"
      aria-label={{this.value1}}
      {{on "click" this.listener1}}
    >+</button></div></template>
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
