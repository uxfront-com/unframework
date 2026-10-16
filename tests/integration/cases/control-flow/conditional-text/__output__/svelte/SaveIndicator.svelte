<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface SaveIndicatorProps {
    saving: boolean;
    changes: number;
    savedAt?: string;
  }

  type Props = SaveIndicatorProps & { class?: ClassValue; style?: string };

  let { saving, changes, savedAt, class: className, style }: Props = $props();
</script>

<p class={["save-indicator", className]} role="status" {style}>
  {#if saving}<em>Saving</em>{:else}Saved{/if}, {changes === 1 ? "1 change" : `${changes} changes`}{#if savedAt}<time
    datetime={savedAt}
  >{" at " + savedAt}</time>{:else}{" just now"}{/if}
</p>
