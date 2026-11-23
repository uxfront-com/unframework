import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface FilterPanelProps {
  heading: string;
  hint: string;
  category: string;
  expanded: boolean;
  inStockOnly: boolean;
  locked: boolean;
  mandatory: boolean;
  loading: boolean;
  invalid?: boolean;
  current?: "page" | "step";
}

export interface FilterPanelSignature {
  Args: FilterPanelProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class FilterPanel extends Component<FilterPanelSignature> {
  get value1() {
    return this.args.loading ? "Loading results" : "Results ready";
  }

  <template><section
      class="filter-panel"
      aria-label={{@heading}}
      data-category={{@category}}
      data-layout="stacked"
      style={{fallthroughStyle @style}}
      ...attributes
    ><button
      type="button"
      aria-expanded={{enumeratedValue @expanded}}
      aria-describedby="filter-panel-hint"
    >Price filters</button><p id="filter-panel-hint">{{@hint}}</p><details
      open={{@expanded}}
    ><summary>Price range</summary><label>Minimum price<input
      type="number"
      name="min-price"
      required={{@mandatory}}
      disabled={{@locked}}
      aria-invalid={{enumeratedValue @invalid}}
    ></label></details><button
      type="button"
      aria-pressed={{enumeratedValue @inStockOnly}}
      disabled={{@locked}}
    >In stock only</button><nav
      aria-label="Filter steps"
    ><a href="#filters" aria-current={{enumeratedValue @current}}>Filters</a></nav><p
      role="status"
      aria-live="polite"
      aria-busy={{enumeratedValue @loading}}
    >{{this.value1}}</p></section></template>
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
