import { component$, useSignal } from "@qwik.dev/core";

export default component$(() => {
  const open = useSignal(false);
  const colour = useSignal<string | null>(null);
  const note = useSignal<string | null>(null);

  return (
    <section class="filter-panel" aria-label="Filters">
      {open.value ? (
        <button type="button" aria-expanded="true" onClick$={() => (open.value = false)}>
          Hide colours
        </button>
      ) : (
        <button type="button" aria-expanded="false" onClick$={() => (open.value = true)}>
          Show colours
        </button>
      )}
      {open.value ? (
        <div class="colours">
          <button type="button" onClick$={() => (colour.value = "Red")}>
            Red
          </button>
          <button type="button" onClick$={() => (colour.value = "Blue")}>
            Blue
          </button>
          <button
            type="button"
            onClick$={() => {
              colour.value = null;
              open.value = false;
            }}
          >
            Reset
          </button>
        </div>
      ) : null}
      {colour.value ? (
        <div class="selection">
          <p>{`Colour: ${colour.value}`}</p>
          <button
            type="button"
            onClick$={() => (colour.value = null)}
          >{`Clear ${colour.value}`}</button>
        </div>
      ) : (
        <p>No colour</p>
      )}
      {note.value === null ? (
        <button type="button" onClick$={() => (note.value = "")}>
          Add a note
        </button>
      ) : (
        <div class="note">
          <label>
            Note
            <input
              onInput$={(_, element) => (note.value = (element as HTMLInputElement).value)}
              onKeyDown$={(event) => {
                if (event.key === "Escape") {
                  note.value = null;
                }
              }}
            />
          </label>
          <p>{`Draft: "${note.value}"`}</p>
        </div>
      )}
    </section>
  );
});
