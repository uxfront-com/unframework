<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface CityPickerProps {
    cities: string[];
  }

  type Props = CityPickerProps & {
    onchose?: (city: string) => void;
    onnoted?: (text: string) => void;
  };

  let { cities, onchose, onnoted }: Props = $props();

  const uid = $props.id();
  const listId = `uf-id-${uid}-0`;
  let query = $state("");
  let open = $state(false);
  let active = $state(-1);
  let chosen = $state("");
  let notes = $state.raw<string[]>([]);
  const matches = $derived(
    cities.filter((city) => city.toLowerCase().startsWith(query.toLowerCase())),
  );

  function choose(city: string) {
    chosen = city;
    open = false;
    active = -1;
    onchose?.(city);
  }

  function onCityKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        open = true;
        active = Math.min(active + 1, matches.length - 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        active = Math.max(active - 1, 0);
        break;
      case "Enter": {
        event.preventDefault();
        const city = matches[active];
        if (open && city !== undefined) choose(city);
        break;
      }
      case "Escape":
        event.preventDefault();
        open = false;
        active = -1;
        break;
    }
  }

  function onNoteKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const field = event.target as HTMLTextAreaElement;
      notes = [...notes, field.value];
      onnoted?.(field.value);
      field.value = "";
    }
  }
</script>

<section class="city-picker" aria-label="Trip">
  <form role="search" aria-label="Destination" onsubmit={(event) => event.preventDefault()}>
    <label>City<input
      type="search"
      name="city"
      role="combobox"
      aria-autocomplete="list"
      aria-controls={open ? listId : undefined}
      aria-expanded={open}
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      oninput={(event) => {
        query = (event.currentTarget as HTMLInputElement).value;
        open = true;
        active = -1;
      }}
      onkeydown={onCityKeydown}
      onblur={() => (open = false)}
    /></label
    >{#if open}
      <div id={listId} role="listbox" aria-label="Cities">
        {#each matches as city, index (city)}
          <button
            type="button"
            id={`${listId}-${index}`}
            role="option"
            tabindex="-1"
            aria-selected={index === active}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => choose(city)}
          >{city}</button>
        {/each}
      </div>
    {/if}<button type="submit">Search</button>
  </form
  ><p role="status">{chosen === "" ? "No city chosen" : `Chosen: ${chosen}`}</p
  ><label>Note<textarea name="note" onkeydown={onNoteKeydown}></textarea></label
  ><ul aria-label="Notes">
    {#each notes as note, index (index)}
      <li>{note}</li>
    {/each}
  </ul>
</section>
