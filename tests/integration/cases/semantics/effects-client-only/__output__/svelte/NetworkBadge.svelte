<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";

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
  class="network-badge"
  role="status"
  data-checked={online === undefined ? "no" : "yes"}
>{label}</p>
