import type { TOC } from "@ember/component/template-only";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
}

export interface SummarySignature {
  Args: SummaryProps & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

const Summary: TOC<SummarySignature> = <template><div
    class="summary"
    style={{fallthroughStyle "display: table; border-spacing: 8px 4px" @style}}
    ...attributes
  ><div style="display: table-caption; font-weight: 700">Account</div><div
    style="display: table-row"
  ><span style="display: table-cell">Name</span><span style="display: table-cell">{{@name}}</span></div><div
    style="display: table-row"
  ><span style="display: table-cell">Plan</span><span
    style="display: table-cell"
  >{{@plan}} for {{@seats}} seats</span></div><p>Billed to <span
    style="display: table-cell; padding: 0 4px"
  >{{@name}}</span> monthly.</p></div></template>;

export default Summary;

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
