import { type CSSProperties, type KeyboardEvent, useId, useMemo, useRef, useState } from "react";

export interface CityPickerProps {
  cities: string[];
}

export interface CityPickerEvents {
  onChose?: (city: string) => void;
  onNoted?: (text: string) => void;
}

export interface CityPickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function CityPicker({
  cities,
  onChose,
  onNoted,
  className,
  style,
}: CityPickerProps & CityPickerEvents & CityPickerAttributes) {
  const listId = `uf-id-${useId()}`;
  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const [active, setActive] = useState(-1);
  const activeRef = useRef(active);
  const [chosen, setChosen] = useState("");
  const chosenRef = useRef(chosen);
  const [notes, setNotes] = useState<string[]>([]);
  const notesRef = useRef(notes);
  const matches = useMemo(
    () => cities.filter((city) => city.toLowerCase().startsWith(query.toLowerCase())),
    [cities, query],
  );

  function currentMatches() {
    return cities.filter((city) => city.toLowerCase().startsWith(queryRef.current.toLowerCase()));
  }

  function choose(city: string) {
    chosenRef.current = city;
    setChosen(chosenRef.current);
    openRef.current = false;
    setOpen(openRef.current);
    activeRef.current = -1;
    setActive(activeRef.current);
    onChose?.(city);
  }

  function onCityKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        openRef.current = true;
        setOpen(openRef.current);
        activeRef.current = Math.min(activeRef.current + 1, currentMatches().length - 1);
        setActive(activeRef.current);
        break;
      case "ArrowUp":
        event.preventDefault();
        activeRef.current = Math.max(activeRef.current - 1, 0);
        setActive(activeRef.current);
        break;
      case "Enter": {
        event.preventDefault();
        const city = currentMatches()[activeRef.current];
        if (openRef.current && city !== undefined) choose(city);
        break;
      }
      case "Escape":
        event.preventDefault();
        openRef.current = false;
        setOpen(openRef.current);
        activeRef.current = -1;
        setActive(activeRef.current);
        break;
    }
  }

  function onNoteKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const field = event.target as HTMLTextAreaElement;
      notesRef.current = [...notesRef.current, field.value];
      setNotes(notesRef.current);
      onNoted?.(field.value);
      field.value = "";
    }
  }

  return (
    <section className={cx("city-picker", className)} aria-label="Trip" style={style}>
      <form role="search" aria-label="Destination" onSubmit={(event) => event.preventDefault()}>
        <label>
          City
          <input
            type="search"
            name="city"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-expanded={open}
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            onInput={(event) => {
              queryRef.current = (event.currentTarget as HTMLInputElement).value;
              setQuery(queryRef.current);
              openRef.current = true;
              setOpen(openRef.current);
              activeRef.current = -1;
              setActive(activeRef.current);
            }}
            onKeyDown={onCityKeydown}
            onBlur={() => {
              openRef.current = false;
              setOpen(openRef.current);
            }}
          />
        </label>
        {open ? (
          <div id={listId} role="listbox" aria-label="Cities">
            {matches.map((city, index) => (
              <button
                key={city}
                type="button"
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(city)}
              >
                {city}
              </button>
            ))}
          </div>
        ) : null}
        <button type="submit">Search</button>
      </form>
      <p role="status">{chosen === "" ? "No city chosen" : `Chosen: ${chosen}`}</p>
      <label>
        Note
        <textarea name="note" onKeyDown={onNoteKeydown} />
      </label>
      <ul aria-label="Notes">
        {notes.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
