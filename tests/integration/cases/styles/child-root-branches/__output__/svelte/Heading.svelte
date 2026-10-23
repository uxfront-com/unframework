<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { big, text, ...attributes }: { big: boolean; text: string } = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<svelte:element
  this={big ? "h2" : "h3"}
  class="heading"
  {...scopeAttributes(attributes)}
>{text}</svelte:element>
