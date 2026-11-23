import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

export interface SelectModels<T extends string> {
  value: T;
  onUpdateValue?: (value: T) => void;
}

export interface SelectSignature<T extends string> {
  Args: SelectProps<T> & { style?: unknown } & SelectModels<T>;
  Element: HTMLElementTagNameMap["label"];
}

export default class Select<T extends string> extends Component<SelectSignature<T>> {
  get value(): T {
    return this.args.value;
  }

  set value(value: T) {
    this.args.onUpdateValue?.(value);
  }

  value1 = (option_1: NonNullable<this["args"]["options"]>[number]) =>
    String(this.value) === option_1;

  listener1 = (event: Event) => {
    this.value = (event.currentTarget as HTMLSelectElement).value as typeof this.value;
  };

  <template><label
      style={{fallthroughStyle @style}}
      ...attributes
    >{{@label}} <select
      {{on "change" this.listener1}}
    >{{#each @options key="@identity" as |option_1|}}<option
      value={{option_1}} selected={{this.value1 option_1}}
    >{{option_1}}</option>{{/each}}</select></label></template>
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
