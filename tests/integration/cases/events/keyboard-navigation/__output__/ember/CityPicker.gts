import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { getOwner } from "@ember/owner";

export interface CityPickerProps {
  cities: string[];
}

export interface CityPickerEvents {
  onChose?: (city: string) => void;
  onNoted?: (text: string) => void;
}

export interface CityPickerSignature {
  Args: CityPickerProps & { style?: unknown } & CityPickerEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class CityPicker extends Component<CityPickerSignature> {
  choose = (city: string) => {
    this.chosen = city;
    this.open = false;
    this.active = -1;
    this.args.onChose?.(city);
  };

  onCityKeydown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.open = true;
        this.active = Math.min(this.active + 1, this.matches.length - 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        this.active = Math.max(this.active - 1, 0);
        break;
      case "Enter": {
        event.preventDefault();
        const city = this.matches[this.active];
        if (this.open && city !== undefined) this.choose(city);
        break;
      }
      case "Escape":
        event.preventDefault();
        this.open = false;
        this.active = -1;
        break;
    }
  };

  onNoteKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const field = event.target as HTMLTextAreaElement;
      this.notes = [...this.notes, field.value];
      this.args.onNoted?.(field.value);
      field.value = "";
    }
  };

  readonly listId = useId(this);

  @tracked query = "";

  @tracked open = false;

  @tracked active = -1;

  @tracked chosen = "";

  @tracked notes: string[] = [];

  get matches() {
    return this.args.cities.filter((city) =>
      city.toLowerCase().startsWith(this.query.toLowerCase()),
    );
  }

  get value1() {
    return this.open ? this.listId : undefined;
  }

  get value2() {
    return this.open && this.active >= 0 ? `${this.listId}-${this.active}` : undefined;
  }

  listener1 = (event: HTMLElementEventMap["input"]) => {
    this.query = (event.currentTarget as HTMLInputElement).value;
    this.open = true;
    this.active = -1;
  };

  listener2 = () => (this.open = false);

  value3 = (index: number) => `${this.listId}-${index}`;

  value4 = (index: number) => index === this.active;

  listener3 = (event: HTMLElementEventMap["mousedown"]) => event.preventDefault();

  listener4 = (city: NonNullable<this["matches"]>[number]) => () => this.choose(city);

  listener5 = (event: HTMLElementEventMap["submit"]) => event.preventDefault();

  get value5() {
    return this.chosen === "" ? "No city chosen" : `Chosen: ${this.chosen}`;
  }

  <template><section
      class="city-picker"
      aria-label="Trip"
      style={{fallthroughStyle @style}}
      ...attributes
    ><form
      role="search"
      aria-label="Destination"
      {{on "submit" this.listener5}}
    ><label>City<input
      type="search"
      name="city"
      role="combobox"
      aria-autocomplete="list"
      aria-controls={{this.value1}}
      aria-expanded={{enumeratedValue this.open}}
      aria-activedescendant={{this.value2}}
      {{on "input" this.listener1}}
      {{on "keydown" this.onCityKeydown}}
      {{on "blur" this.listener2}}
    ></label>{{#if this.open}}<div
      id={{this.listId}}
      role="listbox"
      aria-label="Cities"
    >{{#each this.matches key="@identity" as |city index|}}<button
      type="button"
      id={{this.value3 index}}
      role="option"
      tabindex="-1"
      aria-selected={{enumeratedValue (this.value4 index)}}
      {{on "mousedown" this.listener3}}
      {{on "click" (this.listener4 city)}}
    >{{city}}</button>{{/each}}</div>{{/if}}<button type="submit">Search</button></form><p
      role="status"
    >{{this.value5}}</p><label>Note<textarea
      name="note"
      {{on "keydown" this.onNoteKeydown}}
    ></textarea></label><ul
      aria-label="Notes"
    >{{#each this.notes key="@index" as |note|}}<li>{{note}}</li>{{/each}}</ul></section></template>
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

/** How many ids each application gave, by its owner. */
const ids = new WeakMap<object, number>();

/**
 * Vue's `useId`: an id unique within the component's application. The server and the client
 * that hydrates its render create the components in the same order, so each gets the same id on
 * both, which a random id would not.
 */
function useId(component: object): string {
  const owner = getOwner(component) ?? component;
  const count = ids.get(owner) ?? 0;
  ids.set(owner, count + 1);
  return `uf-id-${count}`;
}
