import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

export interface DeliverySignature {
  Args: DeliveryProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Delivery extends Component<DeliverySignature> {
  @tracked speed = "express";

  @tracked chosen: string[] = ["insurance"];

  value1 = (value: NonNullable<this["args"]["speeds"]>[number]) => this.speed === value;

  listener1 = (value: NonNullable<this["args"]["speeds"]>[number]) => () => {
    this.speed = value;
  };

  value2 = (extra: NonNullable<this["args"]["extras"]>[number]) => this.chosen.includes(extra);

  listener2 = (extra: NonNullable<this["args"]["extras"]>[number]) => (event: Event) => {
    this.chosen = toggle(this.chosen, extra, (event.currentTarget as HTMLInputElement).checked);
  };

  get value3() {
    return this.chosen.join(", ") || "none";
  }

  <template><section
      aria-label="Delivery"
      style={{fallthroughStyle @style}}
      ...attributes
    ><fieldset><legend>Speed</legend>{{#each @speeds key="@identity" as |value|}}<label><input
      type="radio"
      name="speed"
      value={{value}}
      checked={{this.value1 value}}
      {{on "change" (this.listener1 value)}}
    > {{value}}</label>{{/each}}</fieldset><fieldset><legend>Extras</legend>{{#each @extras key="@identity" as |extra|}}<label><input
      type="checkbox"
      value={{extra}}
      checked={{this.value2 extra}}
      {{on "change" (this.listener2 extra)}}
    > {{extra}}</label>{{/each}}</fieldset><output>Speed: {{this.speed}}, extras: {{this.value3}}</output></section></template>
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
