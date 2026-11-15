<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Rows from "./Rows.svelte";
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { row?: Snippet; class?: ClassValue; style?: string };

  let { row, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["wrapper", className]} aria-label="Rows" {style} {...scopeAttributes(attributes)}>
  <Rows {row} />
</section>
