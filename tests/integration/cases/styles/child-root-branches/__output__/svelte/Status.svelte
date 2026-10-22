<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { busy, text }: { busy: boolean; text: string } = $props();
</script>

{#if busy}
  <span class="badge" role="status">Saving</span>
{:else}
  <button type="button" class="badge">{text}</button>
{/if}
