import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

export interface StepperSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Stepper extends Component<StepperSignature> {
  add = (step: number) => {
    this.value = Math.min(LIMITS.max, this.value + step);
  };

  @tracked value = START;

  get value1() {
    return caption(this.value);
  }

  get value2() {
    return STEPS;
  }

  listener1 = (step: NonNullable<this["value2"]>[number]) => () => this.add(step);

  <template><section
      class="stepper"
      aria-label="Stepper"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p role="status">{{this.value1}}</p><ul>{{#each this.value2 key="@identity" as |step|}}<li><button
      type="button"
      {{on "click" (this.listener1 step)}}
    >Add {{step}}</button></li>{{/each}}</ul></section></template>
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
