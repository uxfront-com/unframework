import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

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

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
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
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
