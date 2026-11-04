<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useClock } from "./useClock.svelte";
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let ready = $state(false);

  onMount(() => {
    ready = true;
  });

  const clock = useClock();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<p
  class={["clock", className]}
  {style}
  {...scopeAttributes(attributes)}
>{ready ? "Ready" : "Waiting"}, {clock.started ? "started" : "stopped"}</p>
