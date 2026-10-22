<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Counter from "./Counter.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let counter: { increment(): void; reset(): void } | null = null;

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["controls", className]} {style} {...scopeAttributes(attributes)}>
  <Counter bind:this={counter} start={10}
  /><button type="button" onclick={() => counter?.increment()}>More</button
  ><button type="button" onclick={() => counter?.reset()}>Reset</button>
</div>
