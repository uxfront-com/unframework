<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { scopeAttributes } from "./_unframework/scopeAttributes";

  let { busy, text, ...attributes }: { busy: boolean; text: string } = $props();
</script>

{#if busy}
  <span class="badge" role="status" {...scopeAttributes(attributes)}>Saving</span>
{:else}
  <button type="button" class="badge" {...scopeAttributes(attributes)}>{text}</button>
{/if}
