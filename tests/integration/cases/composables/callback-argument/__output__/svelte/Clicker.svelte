<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useCounter } from "./useCounter.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { onlimit?: (count: number) => void; class?: ClassValue; style?: string };

  let { onlimit, class: className, style, ...attributes }: Props = $props();

  let message = $state("Keep going");

  const counter = useCounter(3, (reached) => {
    message = `Reached ${reached}`;
    onlimit?.(reached);
  });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["clicker", className]}
  aria-label="Clicker"
  {style}
  {...scopeAttributes(attributes)}
>
  <p role="status">Count: {counter.count}</p
  ><p>{message}</p
  ><button type="button" onclick={() => counter.increment()}>Add {counter.step}</button
  ><button type="button" onclick={() => counter.reset()}>Reset</button>
</section>
