import { For, Show, createMemo, createSignal, createUniqueId } from "solid-js";

export interface CityPickerProps {
  cities: string[];
}

export interface CityPickerEvents {
  onChose?: (city: string) => void;
  onNoted?: (text: string) => void;
}

export default function CityPicker(props: CityPickerProps & CityPickerEvents) {
  const listId = `uf-id-${createUniqueId()}`;
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  const [chosen, setChosen] = createSignal("");
  const [notes, setNotes] = createSignal<string[]>([]);
  const matches = createMemo(() =>
    props.cities.filter((city) => city.toLowerCase().startsWith(query().toLowerCase())),
  );

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
    <section class="city-picker" aria-label="Trip">
      <form role="search" aria-label="Destination" onSubmit={(event) => event.preventDefault()}>
        <label>
          City
          <input
            type="search"
            name="city"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={open() ? listId : undefined}
            aria-expanded={open()}
            aria-activedescendant={open() && active() >= 0 ? `${listId}-${active()}` : undefined}
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
            <For each={matches()}>
              {(city, index) => (
                <button
                  type="button"
                  id={`${listId}-${index()}`}
                  role="option"
                  tabindex="-1"
                  aria-selected={index() === active()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(city)}
                >
                  {city}
                </button>
              )}
            </For>
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
        <For each={notes()}>{(note) => <li>{note}</li>}</For>
      </ul>
    </section>
  );
}
