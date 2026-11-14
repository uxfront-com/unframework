<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Track {
    id: number;
    title: string;
    starred: boolean;
  }

  export interface PlaylistProps {
    initial: Track[];
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = PlaylistProps & { class?: ClassValue; style?: string };

  let { initial, class: className, style, ...attributes }: Props = $props();

  let tracks = $state.raw(untrack(() => initial));

  function sortByTitle() {
    tracks = tracks.toSorted((a, b) => a.title.localeCompare(b.title));
  }

  function toggleStar(id: number) {
    tracks = tracks.map((track) =>
      track.id === id ? { ...track, starred: !track.starred } : track,
    );
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["playlist", className]} {style} {...scopeAttributes(attributes)}>
  <ol aria-label="Playlist">
    {#each tracks as track (track.id)}
      <li>
        <label><input type="checkbox" name="queued" {...{ value: track.id }} />{track.starred ? `${track.title} (starred)` : track.title}</label
        ><button
          type="button"
          aria-pressed={track.starred}
          onclick={() => toggleStar(track.id)}
        >{`Star ${track.title}`}</button>
      </li>
    {/each}
  </ol
  ><button type="button" onclick={sortByTitle}>Sort by title</button>
</section>
