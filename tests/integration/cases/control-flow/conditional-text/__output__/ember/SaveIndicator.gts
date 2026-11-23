import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export interface SaveIndicatorSignature {
  Args: SaveIndicatorProps & { style?: unknown };
  Element: HTMLElementTagNameMap["p"];
}

export default class SaveIndicator extends Component<SaveIndicatorSignature> {
  get value1() {
    return this.args.changes === 1 ? "1 change" : `${this.args.changes} changes`;
  }

  get value2() {
    return this.args.savedAt ? " at " + this.args.savedAt : undefined;
  }

  <template><p
      class="save-indicator"
      role="status"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#if @saving}}<em>Saving</em>{{else}}Saved{{/if}}, {{this.value1}}{{#if @savedAt}}<time
      datetime={{@savedAt}}
    >{{this.value2}}</time>{{else}} just now{{/if}}</p></template>
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
