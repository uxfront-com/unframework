<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let colour = $state("none");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Colours" class={className} {style} {...scopeAttributes(attributes)}>
  <select
    size="3"
    aria-label="Colour"
    onchange={(event) => (colour = (event.currentTarget as HTMLSelectElement).value)}
  >
    <option value="red">Red</option
    ><option value="green">Green</option
    ><option value="blue">Blue</option>
  </select
  ><output>Picked: {colour}</output>
</section>
