import { type CSSProperties, useRef, useState } from "react";

export interface Track {
  id: number;
  title: string;
  starred: boolean;
}

export interface PlaylistProps {
  initial: Track[];
}

export interface PlaylistAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Playlist({
  initial,
  className,
  style,
  ...attributes
}: PlaylistProps & PlaylistAttributes) {
  const [tracks, setTracks] = useState(initial);
  const tracksRef = useRef(tracks);

  function sortByTitle() {
    tracksRef.current = tracksRef.current.toSorted((a, b) => a.title.localeCompare(b.title));
    setTracks(tracksRef.current);
  }

  function toggleStar(id: number) {
    tracksRef.current = tracksRef.current.map((track) =>
      track.id === id ? { ...track, starred: !track.starred } : track,
    );
    setTracks(tracksRef.current);
  }

  return (
    <section className={cx("playlist", className)} style={style} {...scopeAttributes(attributes)}>
      <ol aria-label="Playlist">
        {tracks.map((track) => (
          <li key={track.id}>
            <label>
              <input type="checkbox" name="queued" value={track.id} />
              {track.starred ? `${track.title} (starred)` : track.title}
            </label>
            <button
              type="button"
              aria-pressed={track.starred}
              onClick={() => toggleStar(track.id)}
            >{`Star ${track.title}`}</button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={sortByTitle}>
        Sort by title
      </button>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
