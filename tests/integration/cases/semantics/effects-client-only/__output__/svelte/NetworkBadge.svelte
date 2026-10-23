<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<p
  class={["network-badge", className]}
  role="status"
  data-checked={online === undefined ? "no" : "yes"}
  {style}
  {...scopeAttributes(attributes)}
>{label}</p>
