import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { getOwner } from "@ember/owner";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export interface SizePickerSignature {
  Args: SizePickerProps & { style?: unknown };
  Element: HTMLElementTagNameMap["fieldset"];
}

export default class SizePicker extends Component<SizePickerSignature> {
  choose = (size: string) => {
    this.picked = size;
  };

  readonly group = useId(this);

  readonly hintId = useId(this);

  @tracked picked = "";

  value1 = (index: number) => `${this.group}-${index}`;

  listener1 = (size: NonNullable<this["args"]["sizes"]>[number]) => () => this.choose(size);

  get value2() {
    return this.picked || "none";
  }

  <template><fieldset
      class="size-picker"
      aria-describedby={{this.hintId}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><legend>{{@legend}}</legend><p id={{this.hintId}}>Pick one size.</p>{{#each @sizes key="@identity" as |size index|}}<div
      class="size"
    ><input
      type="radio"
      id={{this.value1 index}}
      name={{this.group}}
      value={{size}}
      {{on "change" (this.listener1 size)}}
    ><label for={{this.value1 index}}>{{size}}</label></div>{{/each}}<output>{{this.value2}}</output></fieldset></template>
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

/** How many ids each application gave, by its owner. */
const ids = new WeakMap<object, number>();

/**
 * Vue's `useId`: an id unique within the component's application. The server and the client
 * that hydrates its render create the components in the same order, so each gets the same id on
 * both, which a random id would not.
 */
function useId(component: object): string {
  const owner = getOwner(component) ?? component;
  const count = ids.get(owner) ?? 0;
  ids.set(owner, count + 1);
  return `uf-id-${count}`;
}
