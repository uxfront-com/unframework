<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Entry {
    id: number;
    html: string;
  }

  export interface ChangelogProps {
    entries: Entry[];
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["ul"], "entries" | "children" | "class" | "style" | "ref"> &
    ChangelogProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["ul"] | null;
    };

  let { entries, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<ul class={["changelog", className]} {style} bind:this={ref} {...attributes}>
  {#each entries as entry (entry.id)}
    <li>{@html entry.html}</li>
  {/each}
</ul>
