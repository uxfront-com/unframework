import { ref } from "@uxfront/unframework";

export interface Track {
  id: number;
  title: string;
  starred: boolean;
}

export interface PlaylistProps {
  initial: Track[];
}

export default function Playlist({ initial }: PlaylistProps) {
  const tracks = ref(initial);

  function sortByTitle() {
    tracks.value = tracks.value.toSorted((a, b) => a.title.localeCompare(b.title));
  }

  function toggleStar(id: number) {
    tracks.value = tracks.value.map((track) =>
      track.id === id ? { ...track, starred: !track.starred } : track,
    );
  }

  return (
    <section class="playlist">
      <ol aria-label="Playlist">
        {tracks.value.map((track) => (
          <li key={track.id}>
            <label>
              <input type="checkbox" name="queued" value={track.id} />
              {track.starred ? `${track.title} (starred)` : track.title}
            </label>
            <button type="button" aria-pressed={track.starred} onClick={() => toggleStar(track.id)}>
              {`Star ${track.title}`}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={sortByTitle}>
        Sort by title
      </button>
    </section>
  );
}
