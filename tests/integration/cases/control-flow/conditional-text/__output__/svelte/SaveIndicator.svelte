<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface SaveIndicatorProps {
    saving: boolean;
    changes: number;
    savedAt?: string;
  }

  let { saving, changes, savedAt }: SaveIndicatorProps = $props();
</script>

<p class="save-indicator" role="status">
  {#if saving}<em>Saving</em>{:else}Saved{/if}, {changes === 1 ? "1 change" : `${changes} changes`}{#if savedAt}<time
    datetime={savedAt}
  >{" at " + savedAt}</time>{:else}{" just now"}{/if}
</p>
