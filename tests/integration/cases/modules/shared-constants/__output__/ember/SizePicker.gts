import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";

export interface SizePickerSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["fieldset"];
}

export default class SizePicker extends Component<SizePickerSignature> {
  pick = (next: Size) => {
    this.size = next;
  };

  @tracked size: Size = DEFAULT_SIZE;

  get value1() {
    return SIZES[this.size];
  }

  get value2() {
    return SIZE_ORDER;
  }

  value3 = (each_1: NonNullable<this["value2"]>[number]) => SIZES[each_1];

  value4 = (each_1: NonNullable<this["value2"]>[number]) => this.size === each_1;

  listener1 = (each_1: NonNullable<this["value2"]>[number]) => () => this.pick(each_1);

  <template><fieldset
      class="size-picker"
      style={{fallthroughStyle @style}}
      ...attributes
    ><legend>Size</legend><p role="status">Picked: {{this.value1}}</p><ul>{{#each this.value2 key="@identity" as |each_1|}}<li><button
      type="button"
      aria-pressed={{enumeratedValue (this.value4 each_1)}}
      {{on "click" (this.listener1 each_1)}}
    >{{this.value3 each_1}}</button></li>{{/each}}</ul></fieldset></template>
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
