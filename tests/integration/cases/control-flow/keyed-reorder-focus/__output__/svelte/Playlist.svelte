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
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "initial" | "children" | "class" | "style" | "ref"
  > &
    PlaylistProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let { initial, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let tracks = $state.raw(untrack(() => initial));

  function sortByTitle() {
    tracks = tracks.toSorted((a, b) => a.title.localeCompare(b.title));
  }

  function toggleStar(id: number) {
    tracks = tracks.map((track) =>
      track.id === id ? { ...track, starred: !track.starred } : track,
    );
  }
</script>

<section class={["playlist", className]} {style} bind:this={ref} {...attributes}>
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
