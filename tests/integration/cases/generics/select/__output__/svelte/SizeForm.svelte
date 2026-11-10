<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Select from "./Select.svelte";
  import type { ClassValue } from "svelte/elements";

  type Size = "s" | "m" | "l";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  const sizes: Size[] = ["s", "m", "l"];
  let size = $state<Size>("m");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Size" class={className} {style} {...scopeAttributes(attributes)}>
  <Select label="Size" options={sizes} bind:value={size} /><output>Chosen: {size}</output>
</section>
