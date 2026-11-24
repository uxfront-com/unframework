import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, splitProps, untrack } from "solid-js";

export interface Track {
  id: number;
  title: string;
  starred: boolean;
}

export interface PlaylistProps {
  initial: Track[];
}

export default function Playlist(
  props: PlaylistProps &
    Omit<ComponentProps<"section">, "initial" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["initial", "class"]);

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
    <section class={props.class ? `playlist ${props.class}` : "playlist"} {...others}>
      <ol aria-label="Playlist">
        <KeyedFor each={tracks()} by={(track) => track.id}>
          {(track) => (
            <li>
              <label>
                <input type="checkbox" name="queued" value={track.value.id} />
                {track.value.starred ? `${track.value.title} (starred)` : track.value.title}
              </label>
              <button
                type="button"
                aria-pressed={track.value.starred}
                onClick={() => toggleStar(track.value.id)}
              >{`Star ${track.value.title}`}</button>
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
