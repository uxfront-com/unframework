import { computed, defineEmits, ref, useId } from "unframework";

export interface CityPickerProps {
  cities: string[];
}

export default function CityPicker({ cities }: CityPickerProps) {
  const emit = defineEmits<{ chose: [city: string]; noted: [text: string] }>();

  const listId = useId();
  const query = ref("");
  const open = ref(false);
  const active = ref(-1);
  const chosen = ref("");
  const notes = ref<string[]>([]);

  const matches = computed(() =>
    cities.filter((city) => city.toLowerCase().startsWith(query.value.toLowerCase())),
  );

  function choose(city: string) {
    chosen.value = city;
    open.value = false;
    active.value = -1;
    emit("chose", city);
  }

  function onCityKeydown(event: KeyboardEvent) {
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
        if (open.value && city !== undefined) choose(city);
        break;
      }
      case "Escape":
        event.preventDefault();
        open.value = false;
        active.value = -1;
        break;
    }
  }

  function onNoteKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const field = event.target as HTMLTextAreaElement;
      notes.value = [...notes.value, field.value];
      emit("noted", field.value);
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
            aria-controls={open.value ? listId : undefined}
            aria-expanded={open.value}
            aria-activedescendant={
              open.value && active.value >= 0 ? `${listId}-${active.value}` : undefined
            }
            onInput={(event) => {
              query.value = (event.currentTarget as HTMLInputElement).value;
              open.value = true;
              active.value = -1;
            }}
            onKeydown={onCityKeydown}
            onBlur={() => (open.value = false)}
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
                tabindex="-1"
                aria-selected={index === active.value}
                onMousedown={(event) => event.preventDefault()}
                onClick={() => choose(city)}
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
        <textarea name="note" onKeydown={onNoteKeydown} />
      </label>
      <ul aria-label="Notes">
        {notes.value.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
    </section>
  );
}
