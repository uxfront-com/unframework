<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Entry {
    id: string;
    label: string;
  }

  export interface ChecklistProps {
    entries: Entry[];
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["ul"], "entries" | "children" | "class" | "style" | "ref"> &
    ChecklistProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["ul"] | null;
    };

  let { entries, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<ul class={["checklist", className]} {style} bind:this={ref} {...attributes}>
  {#each entries as entry (entry.id)}
    <li>
      <label>{entry.label}<input name={`note-${entry.id}`} aria-label={`Note for ${entry.label}`} /></label>
    </li>
  {/each}
</ul>
