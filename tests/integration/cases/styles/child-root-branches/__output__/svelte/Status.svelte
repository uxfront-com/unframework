<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { busy, text, ...attributes }: { busy: boolean; text: string } = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

{#if busy}
  <span class="badge" role="status" {...scopeAttributes(attributes)}>Saving</span>
{:else}
  <button type="button" class="badge" {...scopeAttributes(attributes)}>{text}</button>
{/if}
