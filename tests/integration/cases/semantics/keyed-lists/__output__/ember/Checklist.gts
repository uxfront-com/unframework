import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface Entry {
  id: string;
  label: string;
}

export interface ChecklistProps {
  entries: Entry[];
}

export interface ChecklistSignature {
  Args: ChecklistProps & { style?: unknown };
  Element: HTMLElementTagNameMap["ul"];
}

export default class Checklist extends Component<ChecklistSignature> {
  value1 = (entry: NonNullable<this["args"]["entries"]>[number]) => `note-${entry.id}`;

  value2 = (entry: NonNullable<this["args"]["entries"]>[number]) => `Note for ${entry.label}`;

  <template><ul
      class="checklist"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#each @entries key="id" as |entry|}}<li><label>{{entry.label}}<input
      name={{this.value1 entry}}
      aria-label={{this.value2 entry}}
    ></label></li>{{/each}}</ul></template>
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
