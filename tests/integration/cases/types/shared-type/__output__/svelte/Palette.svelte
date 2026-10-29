<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  import type { Tone } from "./types";

  export type { Tone } from "./types";
</script>

<script lang="ts">
  import Swatch from "./Swatch.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { tone: Tone; class?: ClassValue; style?: string };

  let { tone, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["palette", className]} {style} {...scopeAttributes(attributes)}>
  <Swatch {tone} />
</div>
