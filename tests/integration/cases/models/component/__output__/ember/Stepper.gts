import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface StepperModels {
  value?: number;
  onUpdateValue?: (value: number) => void;
}

export interface StepperSignature {
  Args: { label: string } & { style?: unknown } & StepperModels;
  Element: HTMLElementTagNameMap["div"];
}

export default class Stepper extends Component<StepperSignature> {
  @tracked valueLocal: number = 0;

  get value(): number {
    return this.args.value === undefined ? this.valueLocal : this.args.value;
  }

  set value(value: number) {
    this.valueLocal = value;
    this.args.onUpdateValue?.(value);
  }

  get value1() {
    return `Fewer ${this.args.label}`;
  }

  listener1 = () => (this.value -= 1);

  get value2() {
    return `More ${this.args.label}`;
  }

  listener2 = () => (this.value += 1);

  <template><div
      class="stepper"
      style={{fallthroughStyle @style}}
      ...attributes
    ><button type="button" aria-label={{this.value1}} {{on "click" this.listener1}}>-</button><span>{{@label}}: {{this.value}}</span><button
      type="button"
      aria-label={{this.value2}}
      {{on "click" this.listener2}}
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
