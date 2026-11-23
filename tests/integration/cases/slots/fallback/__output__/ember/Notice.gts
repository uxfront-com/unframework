import type { TOC } from "@ember/component/template-only";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface NoticeSignature {
  Args: { label: string } & { style?: unknown };
  Blocks: { default: []; action: [] };
  Element: HTMLElementTagNameMap["div"];
}

const Notice: TOC<NoticeSignature> = <template><div
    role="note"
    aria-label={{@label}}
    class="notice"
    style={{fallthroughStyle @style}}
    ...attributes
  ><p>{{#if (has-block)}}{{yield}}{{else}}<em>Nothing to report.</em>{{/if}}</p>{{#if (has-block "action")}}{{yield to="action"}}{{else}}<span
    class="muted"
  >No action</span>{{/if}}</div></template>;

export default Notice;

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
