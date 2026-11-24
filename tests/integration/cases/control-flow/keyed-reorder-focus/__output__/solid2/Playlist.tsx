import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, untrack } from "solid-js";

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
    Omit<ComponentProps<"section">, "initial" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "initial", "class");

  const [tracks, setTracks] = createState(untrack(() => props.initial));

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
                aria-pressed={enumeratedValue(track.value.starred)}
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
