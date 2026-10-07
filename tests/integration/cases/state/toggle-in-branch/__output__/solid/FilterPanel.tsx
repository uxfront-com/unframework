import { Match, Show, Switch, createSignal } from "solid-js";

export default function FilterPanel() {
  const [open, setOpen] = createSignal(false);
  const [colour, setColour] = createSignal<string | null>(null);
  const [note, setNote] = createSignal<string | null>(null);

  return (
    <section class="filter-panel" aria-label="Filters">
      <Show
        when={open()}
        fallback={
          <button type="button" aria-expanded="false" onClick={() => setOpen(true)}>
            Show colours
          </button>
        }
      >
        <button type="button" aria-expanded="true" onClick={() => setOpen(false)}>
          Hide colours
        </button>
      </Show>
      <Show when={open()}>
        <div class="colours">
          <button type="button" onClick={() => setColour("Red")}>
            Red
          </button>
          <button type="button" onClick={() => setColour("Blue")}>
            Blue
          </button>
          <button
            type="button"
            onClick={() => {
              setColour(null);
              setOpen(false);
            }}
          >
            Reset
          </button>
        </div>
      </Show>
      <Show when={colour()} fallback={<p>No colour</p>}>
        {(colour_1) => (
          <div class="selection">
            <p>{`Colour: ${colour_1()}`}</p>
            <button type="button" onClick={() => setColour(null)}>{`Clear ${colour_1()}`}</button>
          </div>
        )}
      </Show>
      <Switch>
        <Match when={note() === null}>
          <button type="button" onClick={() => setNote("")}>
            Add a note
          </button>
        </Match>
        <Match when={((note) => (note === null ? undefined : { note }))(note())}>
          {(narrowed) => (
            <div class="note">
              <label>
                Note
                <input
                  onInput={(event) => setNote((event.currentTarget as HTMLInputElement).value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setNote(null);
                    }
                  }}
                />
              </label>
              <p>{`Draft: "${narrowed().note}"`}</p>
            </div>
          )}
        </Match>
      </Switch>
    </section>
  );
}
