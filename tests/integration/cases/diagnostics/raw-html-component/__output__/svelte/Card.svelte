<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { heading: string; class?: ClassValue; style?: string };

  let { heading, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["card", className]} {style} {...scopeAttributes(attributes)}>
  <h2>{heading}</h2>
</section>
