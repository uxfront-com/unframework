<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

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
>{label}</p>
