import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface PriceRangeModels {
  min?: number;
  onUpdateMin?: (value: number) => void;
  max?: number;
  onUpdateMax?: (value: number) => void;
}

export interface PriceRangeSignature {
  Args: { label: string } & { style?: unknown } & PriceRangeModels;
  Element: HTMLElementTagNameMap["fieldset"];
}

export default class PriceRange extends Component<PriceRangeSignature> {
  widen = () => {
    this.min -= 10;
    this.max += 10;
  };

  @tracked minLocal: number = 0;

  get min(): number {
    return this.args.min === undefined ? this.minLocal : this.args.min;
  }

  set min(value: number) {
    this.minLocal = value;
    this.args.onUpdateMin?.(value);
  }

  @tracked maxLocal: number = 100;

  get max(): number {
    return this.args.max === undefined ? this.maxLocal : this.args.max;
  }

  set max(value: number) {
    this.maxLocal = value;
    this.args.onUpdateMax?.(value);
  }

  <template><fieldset
      style={{fallthroughStyle @style}}
      ...attributes
    ><legend>{{@label}}</legend><p>From {{this.min}} to {{this.max}}</p><button
      type="button"
      {{on "click" this.widen}}
    >Widen</button></fieldset></template>
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
