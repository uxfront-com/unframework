<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Countdown from "./Countdown.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { from: number; class?: ClassValue; style?: string };

  let { from, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["level", className]} {style} {...scopeAttributes(attributes)}>
  <span>{from}</span
  >{#if from > 0}
    <Countdown from={from - 1} />
  {:else}
    <strong>Liftoff</strong>
  {/if}
</div>
