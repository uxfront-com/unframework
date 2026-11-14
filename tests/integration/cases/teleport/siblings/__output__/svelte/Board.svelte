<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Panel from "./Panel.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let shown = $state(true);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<main class={["board", className]} {style} {...scopeAttributes(attributes)}>
  <button type="button" onclick={() => (shown = false)}>Remove panel</button
  >{#if shown}
    <Panel />
  {/if}
</main>
