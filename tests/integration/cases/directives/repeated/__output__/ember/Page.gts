import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { capabilities, setModifierManager } from "@ember/modifier";
import type { ModifierLike } from "@glint/template";
import Choice from "./Choice.gts";
import List from "./List.gts";
import Wrapper from "./Wrapper.gts";
import { vTrace } from "./vTrace.ts";

export interface PageSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Page extends Component<PageSignature> {
  @tracked label = "first";

  @tracked note: HTMLParagraphElement | null = null;

  @tracked noted = "";

  get value1() {
    return ["a", "b"];
  }

  listener1 = () => (this.noted = this.note?.getAttribute("data-name") ?? "");

  listener2 = () => (this.label = "second");

  <template><section
      class="page"
      aria-label="Page"
      style={{fallthroughStyle @style}}
      ...attributes
    ><Wrapper><:row><span data-name="row" {{vTrace this.label}}>Row</span></:row></Wrapper><Choice><:body><em
      data-name="body"
      {{vTrace this.label}}
    >Body</em></:body></Choice><List
      @items={{this.value1}}
    ><:item as |itemProps|><strong
      data-name="item"
      {{vTrace this.label}}
    >{{itemProps.item}}</strong></:item></List><p
      {{templateRef this "note"}}
      data-name="note"
      {{vTrace this.label}}
    >Note</p><output>{{this.noted}}</output><button
      type="button"
      {{on "click" this.listener1}}
    >Check</button><button type="button" {{on "click" this.listener2}}>Rename</button></section></template>
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

/** A modifier that sets a member of its component to its element while the element is rendered. */
const templateRef = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: () => ({}),
    installModifier(
      _state: object,
      element: Element,
      { positional }: { positional: readonly unknown[] },
    ) {
      Reflect.set(positional[0] as object, positional[1] as string, element);
    },
    updateModifier() {},
    destroyModifier(_state: object, { positional }: { positional: readonly unknown[] }) {
      Reflect.set(positional[0] as object, positional[1] as string, null);
    },
  }),
  {},
) as unknown as ModifierLike<{
  Element: Element;
  Args: { Positional: [owner: object, name: string] };
}>;
