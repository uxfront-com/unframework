import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export interface Track {
  id: number;
  title: string;
  starred: boolean;
}

export interface PlaylistProps {
  initial: Track[];
}

export default component$<PlaylistProps & { class?: ClassList; style?: CSSProperties }>(
  ({ initial, class: className, style, ...attributes }) => {
    const tracks = useSignal(initial);

    const sortByTitle = $(() => {
      tracks.value = tracks.value.toSorted((a, b) => a.title.localeCompare(b.title));
    });

    const toggleStar = $((id: number) => {
      tracks.value = tracks.value.map((track) =>
        track.id === id ? { ...track, starred: !track.starred } : track,
      );
    });

    return (
      <section class={["playlist", className]} {...scopeAttributes(attributes)} style={style}>
        <ol aria-label="Playlist">
          {tracks.value.map((track) => (
            <li key={track.id}>
              <label>
                <input type="checkbox" name="queued" value={track.id} />
                {track.starred ? `${track.title} (starred)` : track.title}
              </label>
              <button
                type="button"
                aria-pressed={track.starred}
                onClick$={() => toggleStar(track.id)}
              >{`Star ${track.title}`}</button>
            </li>
          ))}
        </ol>
        <button type="button" onClick$={sortByTitle}>
          Sort by title
        </button>
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
