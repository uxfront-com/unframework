import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Match, Show, Switch, omit } from "solid-js";

export default function FilterPanel(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [open, setOpen] = createState(false);
  const [colour, setColour] = createState<string | null>(null);
  const [note, setNote] = createState<string | null>(null);

  return (
    <section
      class={props.class ? `filter-panel ${props.class}` : "filter-panel"}
      aria-label="Filters"
      {...others}
    >
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
