<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useClock } from "./useClock.svelte";
  import { onMount } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let ready = $state(false);

  onMount(() => {
    ready = true;
  });

  const clock = useClock();
</script>

<p
  class={["clock", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{ready ? "Ready" : "Waiting"}, {clock.started ? "started" : "stopped"}</p>
