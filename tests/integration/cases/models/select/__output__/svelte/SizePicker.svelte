<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let size = $state("m");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Size" class={className} {style} {...scopeAttributes(attributes)}>
  <label>Size <select
    bind:value={size}
  ><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option></select></label
  ><output>Chosen: {size}</output
  ><button type="button" onclick={() => (size = "l")}>Largest</button>
</section>
