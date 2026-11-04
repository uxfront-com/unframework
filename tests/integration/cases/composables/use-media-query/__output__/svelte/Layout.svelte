<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useMediaQuery } from "./useMediaQuery.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  const wide = useMediaQuery("(min-width: 1px)");
  const tiny = useMediaQuery("(max-width: 1px)");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["layout", className]} aria-label="Layout" {style} {...scopeAttributes(attributes)}>
  <p role="status">{wide.matches ? "Wide layout" : "Narrow layout"}</p
  ><p>{tiny.matches ? "Tiny screen" : "Not a tiny screen"}</p>
</section>
