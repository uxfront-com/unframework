import type { JSX } from "@solidjs/web";
import {
  For,
  Show,
  createMemo,
  createSignal,
  createUniqueId,
  getObserver,
  untrack,
} from "solid-js";

export interface CityPickerProps {
  cities: string[];
}

export interface CityPickerEvents {
  onChose?: (city: string) => void;
  onNoted?: (text: string) => void;
}

export default function CityPicker(
  props: CityPickerProps & CityPickerEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const listId = `uf-id-${createUniqueId()}`;
  const [query, setQuery] = createState("");
  const [open, setOpen] = createState(false);
  const [active, setActive] = createState(-1);
  const [chosen, setChosen] = createState("");
  const [notes, setNotes] = createState<string[]>([]);
  const matches = () =>
    props.cities.filter((city) => city.toLowerCase().startsWith(query().toLowerCase()));

  function choose(city: string) {
    setChosen(city);
    setOpen(false);
    setActive(-1);
    props.onChose?.(city);
  }

  function onCityKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setActive(Math.min(active() + 1, matches().length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive(Math.max(active() - 1, 0));
        break;
      case "Enter": {
        event.preventDefault();
        const city = matches()[active()];
        if (open() && city !== undefined) choose(city);
        break;
      }
      case "Escape":
        event.preventDefault();
        setOpen(false);
        setActive(-1);
        break;
    }
  }

  function onNoteKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const field = event.target as HTMLTextAreaElement;
      setNotes([...notes(), field.value]);
      props.onNoted?.(field.value);
      field.value = "";
    }
  }

  return (
    <section
      class={props.class ? `city-picker ${props.class}` : "city-picker"}
      aria-label="Trip"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <form role="search" aria-label="Destination" onSubmit={(event) => event.preventDefault()}>
        <label>
          City
          <input
            type="search"
            name="city"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={enumeratedValue(open() ? listId : undefined)}
            aria-expanded={enumeratedValue(open())}
            aria-activedescendant={enumeratedValue(
              open() && active() >= 0 ? `${listId}-${active()}` : undefined,
            )}
            onInput={(event) => {
              setQuery((event.currentTarget as HTMLInputElement).value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={onCityKeydown}
            onBlur={() => setOpen(false)}
          />
        </label>
        <Show when={open()}>
          <div id={listId} role="listbox" aria-label="Cities">
            <KeyedFor each={matches()} by={(city) => city}>
              {(city) => (
                <button
                  type="button"
                  id={`${listId}-${city.index}`}
                  role="option"
                  tabindex="-1"
                  aria-selected={enumeratedValue(city.index === active())}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(city.value)}
                >
                  {city.value}
                </button>
              )}
            </KeyedFor>
          </div>
        </Show>
        <button type="submit">Search</button>
      </form>
      <p role="status">{chosen() === "" ? "No city chosen" : `Chosen: ${chosen()}`}</p>
      <label>
        Note
        <textarea name="note" onKeyDown={onNoteKeydown} />
      </label>
      <ul aria-label="Notes">
        <KeyedFor each={notes()} by={(note, index) => index}>
          {(note) => <li>{note.value}</li>}
        </KeyedFor>
      </ul>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
