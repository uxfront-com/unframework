import { $, type QRL, component$, sync$, useComputed$, useId, useSignal } from "@qwik.dev/core";

export interface CityPickerProps {
  cities: string[];
}

export interface CityPickerEvents {
  onChose$?: QRL<(city: string) => void>;
  onNoted$?: QRL<(text: string) => void>;
}

export default component$<CityPickerProps & CityPickerEvents>(({ cities, onChose$, onNoted$ }) => {
  const listId = "uf-id-" + useId();
  const query = useSignal("");
  const open = useSignal(false);
  const active = useSignal(-1);
  const chosen = useSignal("");
  const notes = useSignal<string[]>([]);
  const matches = useComputed$(() =>
    cities.filter((city) => city.toLowerCase().startsWith(query.value.toLowerCase())),
  );

  const choose = $((city: string) => {
    chosen.value = city;
    open.value = false;
    active.value = -1;
    onChose$?.(city);
  });

  const onCityKeydown = $(async (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        open.value = true;
        active.value = Math.min(active.value + 1, matches.value.length - 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        active.value = Math.max(active.value - 1, 0);
        break;
      case "Enter": {
        event.preventDefault();
        const city = matches.value[active.value];
        if (open.value && city !== undefined) await choose(city);
        break;
      }
      case "Escape":
        event.preventDefault();
        open.value = false;
        active.value = -1;
        break;
    }
  });

  const onNoteKeydown = $((event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const field = event.target as HTMLTextAreaElement;
      notes.value = [...notes.value, field.value];
      onNoted$?.(field.value);
      field.value = "";
    }
  });

  return (
    <section class="city-picker" aria-label="Trip">
      <form
        role="search"
        aria-label="Destination"
        preventdefault:submit
        onSubmit$={sync$((event: SubmitEvent) => {
          event.preventDefault();
        })}
      >
        <label>
          City
          <input
            type="search"
            name="city"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={open.value ? listId : undefined}
            aria-expanded={open.value}
            aria-activedescendant={
              open.value && active.value >= 0 ? `${listId}-${active.value}` : undefined
            }
            onInput$={(_, element) => {
              query.value = (element as HTMLInputElement).value;
              open.value = true;
              active.value = -1;
            }}
            onKeyDown$={onCityKeydown}
            onBlur$={() => (open.value = false)}
          />
        </label>
        {open.value ? (
          <div id={listId} role="listbox" aria-label="Cities">
            {matches.value.map((city, index) => (
              <button
                key={city}
                type="button"
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === active.value}
                preventdefault:mousedown
                onMouseDown$={sync$((event: MouseEvent) => {
                  event.preventDefault();
                })}
                onClick$={() => choose(city)}
              >
                {city}
              </button>
            ))}
          </div>
        ) : null}
        <button type="submit">Search</button>
      </form>
      <p role="status">{chosen.value === "" ? "No city chosen" : `Chosen: ${chosen.value}`}</p>
      <label>
        Note
        <textarea name="note" onKeyDown$={onNoteKeydown} />
      </label>
      <ul aria-label="Notes">
        {notes.value.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
    </section>
  );
});
