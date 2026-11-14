import { type Accessor, For, type JSX, createMemo, createSignal, untrack } from "solid-js";

export interface Track {
  id: number;
  title: string;
  starred: boolean;
}

export interface PlaylistProps {
  initial: Track[];
}

export default function Playlist(
  props: PlaylistProps & { class?: string; style?: JSX.CSSProperties },
) {
  const [tracks, setTracks] = createSignal(untrack(() => props.initial));

  function sortByTitle() {
    setTracks(tracks().toSorted((a, b) => a.title.localeCompare(b.title)));
  }

  function toggleStar(id: number) {
    setTracks(
      tracks().map((track) => (track.id === id ? { ...track, starred: !track.starred } : track)),
    );
  }

  return (
    <section
      class={props.class ? `playlist ${props.class}` : "playlist"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <ol aria-label="Playlist">
        <KeyedFor each={tracks()} by={(track) => track.id}>
          {(track) => (
            <li>
              <label>
                <input type="checkbox" name="queued" value={track().id} />
                {track().starred ? `${track().title} (starred)` : track().title}
              </label>
              <button
                type="button"
                aria-pressed={track().starred}
                onClick={() => toggleStar(track().id)}
              >{`Star ${track().title}`}</button>
            </li>
          )}
        </KeyedFor>
      </ol>
      <button type="button" onClick={sortByTitle}>
        Sort by title
      </button>
    </section>
  );
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
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
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
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
