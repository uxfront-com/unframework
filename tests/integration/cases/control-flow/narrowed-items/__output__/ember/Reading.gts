import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export type Source =
  | { kind: "link"; id: string; title: string; href: string }
  | { kind: "book"; id: string; title: string; note?: string };

export interface ReadingProps {
  sources: Source[];
}

export interface ReadingEvents {
  onOpen?: (href: string) => void;
}

export interface ReadingSignature {
  Args: ReadingProps & { style?: unknown } & ReadingEvents;
  Element: HTMLElementTagNameMap["ul"];
}

export default class Reading extends Component<ReadingSignature> {
  value1 = (index: number) => index + 1;

  value2 = (source: NonNullable<this["args"]["sources"]>[number]) =>
    source.kind === "book" && source.note ? ` (${source.note.trim()})` : "";

  value3 = (source: NonNullable<this["args"]["sources"]>[number]) => source.kind === "link";

  value4 = (source: NonNullable<this["args"]["sources"]>[number]) =>
    source.kind === "link" ? `Open ${source.title}` : undefined;

  listener1 = (source: NonNullable<this["args"]["sources"]>[number]) => () => {
    if (!(source.kind === "link")) return;
    return this.args.onOpen?.(source.href);
  };

  value5 = (source: NonNullable<this["args"]["sources"]>[number]) =>
    source.kind === "link" ? source.href : source.title;

  <template><ul
      class="reading"
      aria-label="Reading list"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#each @sources key="id" as |source index|}}<li
      title={{this.value5 source}}
    >{{this.value1 index}}. {{source.title}}{{this.value2 source}}{{#if (this.value3 source)}}<button
      type="button"
      {{on "click" (this.listener1 source)}}
    >{{this.value4 source}}</button>{{/if}}</li>{{/each}}</ul></template>
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
