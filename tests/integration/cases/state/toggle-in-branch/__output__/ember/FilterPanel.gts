import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface FilterPanelSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class FilterPanel extends Component<FilterPanelSignature> {
  @tracked open = false;

  @tracked colour: string | null = null;

  @tracked note: string | null = null;

  listener1 = () => {
    if (!this.open) return;
    return (this.open = false);
  };

  listener2 = () => {
    if (!!this.open) return;
    return (this.open = true);
  };

  listener3 = () => (this.colour = "Red");

  listener4 = () => (this.colour = "Blue");

  listener5 = () => {
    if (!this.open) return;
    this.colour = null;
    this.open = false;
  };

  get value1() {
    return this.colour ? `Colour: ${this.colour}` : undefined;
  }

  get value2() {
    return this.colour ? `Clear ${this.colour}` : undefined;
  }

  listener6 = () => {
    if (!this.colour) return;
    return (this.colour = null);
  };

  get value3() {
    return this.note === null;
  }

  listener7 = () => {
    if (!(this.note === null)) return;
    return (this.note = "");
  };

  listener8 = (event: HTMLElementEventMap["input"]) => {
    if (!!(this.note === null)) return;
    return (this.note = (event.currentTarget as HTMLInputElement).value);
  };

  listener9 = (event: HTMLElementEventMap["keydown"]) => {
    if (!!(this.note === null)) return;
    if (event.key === "Escape") {
      this.note = null;
    }
  };

  get value4() {
    return !(this.note === null) ? `Draft: "${this.note}"` : undefined;
  }

  <template><section
      class="filter-panel"
      aria-label="Filters"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#if this.open}}<button
      type="button"
      aria-expanded="true"
      {{on "click" this.listener1}}
    >Hide colours</button>{{else}}<button
      type="button"
      aria-expanded="false"
      {{on "click" this.listener2}}
    >Show colours</button>{{/if}}{{#if this.open}}<div
      class="colours"
    ><button type="button" {{on "click" this.listener3}}>Red</button><button
      type="button"
      {{on "click" this.listener4}}
    >Blue</button><button type="button" {{on "click" this.listener5}}>Reset</button></div>{{/if}}{{#if this.colour}}<div
      class="selection"
    ><p>{{this.value1}}</p><button
      type="button"
      {{on "click" this.listener6}}
    >{{this.value2}}</button></div>{{else}}<p>No colour</p>{{/if}}{{#if this.value3}}<button
      type="button"
      {{on "click" this.listener7}}
    >Add a note</button>{{else}}<div
      class="note"
    ><label>Note<input {{on "input" this.listener8}} {{on "keydown" this.listener9}}></label><p>{{this.value4}}</p></div>{{/if}}</section></template>
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
