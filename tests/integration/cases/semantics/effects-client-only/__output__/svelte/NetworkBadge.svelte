<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let online = $state<boolean>();
  let label = $state("Checking the connection");

  let previousOnline = untrack(() => online);
  $effect.pre(() => {
    const value = online;
    if (Object.is(value, previousOnline)) return;
    previousOnline = value;
    untrack(() => {
      label = value ? "Online" : "Offline";
    });
  });

  onMount(() => {
    online = navigator.onLine;
  });
</script>

<p
  class={["network-badge", className]}
  role="status"
  data-checked={online === undefined ? "no" : "yes"}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</p>
