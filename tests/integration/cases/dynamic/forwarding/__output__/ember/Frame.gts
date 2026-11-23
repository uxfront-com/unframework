import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import Card from "./Card.gts";
import Panel from "./Panel.gts";

export interface FrameSignature {
  Args: { label: string; wide: boolean } & { style?: unknown };
  Blocks: { title: [] };
  Element: HTMLElementTagNameMap["section"];
}

export default class Frame extends Component<FrameSignature> {
  get value1() {
    return this.args.wide ? Panel : Card;
  }

  <template><section
      class="frame"
      aria-label={{@label}}
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#if (eq this.value1 Panel)}}{{#if (has-block "title")}}<Panel><:title>{{yield to="title"}}</:title></Panel>{{else}}<Panel />{{/if}}{{else}}{{#if (has-block "title")}}<Card><:title>{{yield to="title"}}</:title></Card>{{else}}<Card />{{/if}}{{/if}}</section></template>
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
