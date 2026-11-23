import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface DisclosureModels {
  open?: boolean;
  onUpdateOpen?: (value: boolean) => void;
}

export interface DisclosureSignature {
  Args: { title: string } & { style?: unknown } & DisclosureModels;
  Element: HTMLElementTagNameMap["div"];
}

export default class Disclosure extends Component<DisclosureSignature> {
  @tracked openLocal: boolean = false;

  get open(): boolean {
    return this.args.open === undefined ? this.openLocal : this.args.open;
  }

  set open(value: boolean) {
    this.openLocal = value;
    this.args.onUpdateOpen?.(value);
  }

  listener1 = () => (this.open = !this.open);

  <template><div
      class="disclosure"
      style={{fallthroughStyle @style}}
      ...attributes
    ><button
      type="button"
      aria-expanded={{enumeratedValue this.open}}
      {{on "click" this.listener1}}
    >{{@title}}</button>{{#if this.open}}<p>Details of {{@title}}</p>{{/if}}</div></template>
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
