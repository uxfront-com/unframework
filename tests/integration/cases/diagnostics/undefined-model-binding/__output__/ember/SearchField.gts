import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface SearchFieldModels {
  query?: string;
  onUpdateQuery?: (value: string) => void;
}

export interface SearchFieldSignature {
  Args: { style?: unknown } & SearchFieldModels;
  Element: HTMLElementTagNameMap["input"];
}

export class SearchField extends Component<SearchFieldSignature> {
  @tracked queryLocal: string | undefined = undefined;

  get query(): string | undefined {
    return this.args.query === undefined ? this.queryLocal : this.args.query;
  }

  set query(value: string | undefined) {
    this.queryLocal = value;
    this.args.onUpdateQuery?.(value);
  }

  listener1 = (event: Event) => {
    this.query = (event.currentTarget as HTMLInputElement).value;
  };

  <template><input
      type="search"
      aria-label="Search"
      value={{this.query}}
      {{on "input" this.listener1}}
      style={{fallthroughStyle @style}}
      ...attributes
    ></template>
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
