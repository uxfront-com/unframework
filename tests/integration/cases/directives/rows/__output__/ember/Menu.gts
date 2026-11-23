import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import Picker, { type PickerSignature } from "./Picker.gts";
import { vMark } from "./vMark.ts";
import { vTrace } from "./vTrace.ts";

export interface MenuSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Menu extends Component<MenuSignature> {
  @tracked items: { id: string; label: string; note?: string }[] = [
    { id: "a", label: "Alpha", note: "First" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ];

  @tracked prefix = "Open";

  @tracked focused = 0;

  value1 = (item: NonNullable<this["items"]>[number]) =>
    item.note ? `note-${item.id}` : undefined;

  value2 = (item: NonNullable<this["items"]>[number]) => `both-${item.id}`;

  value3 = (item: NonNullable<this["items"]>[number]) => `focus-${item.id}`;

  listener1 = () => this.focused++;

  value4 = (item: NonNullable<this["items"]>[number]) => `prefixed-${item.id}`;

  value5 = (item: NonNullable<this["items"]>[number]) => `${this.prefix} ${item.label}`;

  value6 = (optionProps: PickerSignature["Blocks"]["option"][0]) =>
    `option-${optionProps.option.id}`;

  value7 = (optionProps: PickerSignature["Blocks"]["option"][0]) =>
    `${this.prefix} ${optionProps.option.label}`;

  listener2 = () =>
    (this.items = this.items.map((item) =>
      item.id === "a" ? { id: "a", label: "Alpha 2", note: "First" } : item,
    ));

  listener3 = () => (this.items = [...this.items].reverse());

  listener4 = () => (this.items = this.items.filter((item) => item.id !== "b"));

  listener5 = () => (this.items = [...this.items, { id: "d", label: "Delta" }]);

  listener6 = () => (this.prefix = "Close");

  <template><section
      class="menu"
      aria-label="Menu"
      style={{fallthroughStyle @style}}
      ...attributes
    ><ul
      aria-label="Items"
    >{{#each this.items key="id" as |item|}}<li
      data-name={{item.id}}
      {{vTrace item.label}}
    >{{item.label}}{{#if item.note}}<b
      data-name={{this.value1 item}}
      {{vTrace item.note}}
    >{{item.note}}</b>{{/if}}</li>{{/each}}</ul><ul
      aria-label="Marked"
    >{{#each this.items key="id" as |item|}}<li
      data-name={{this.value2 item}}
      {{vTrace item.label}}
      {{vMark item.id}}
    >{{item.label}}</li>{{/each}}</ul><div
      class="focus"
    >{{#each this.items key="id" as |item|}}<button
      type="button"
      data-name={{this.value3 item}}
      {{on "focusin" this.listener1}}
      {{vTrace item.label}}
    >Focus {{item.label}}</button>{{/each}}</div><output>{{this.focused}}</output><ul
      aria-label="Prefixed"
    >{{#each this.items key="id" as |item|}}<li
      data-name={{this.value4 item}}
      {{vTrace (this.value5 item)}}
    >{{item.label}}</li>{{/each}}</ul><Picker><:option as |optionProps|><span
      data-name={{this.value6 optionProps}}
      {{vTrace (this.value7 optionProps)}}
    >{{optionProps.option.label}}</span></:option></Picker><button
      type="button"
      {{on "click" this.listener2}}
    >Rename first</button><button type="button" {{on "click" this.listener3}}>Reverse</button><button
      type="button"
      {{on "click" this.listener4}}
    >Remove second</button><button type="button" {{on "click" this.listener5}}>Add item</button><button
      type="button"
      {{on "click" this.listener6}}
    >Change prefix</button></section></template>
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
