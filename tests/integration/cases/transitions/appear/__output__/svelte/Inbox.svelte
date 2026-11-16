<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Toast from "./Toast.svelte";
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

<section aria-label="Inbox" class={className} {style} {...scopeAttributes(attributes)}>
  <button type="button" onclick={() => (shown = !shown)}>{shown ? "Hide" : "Show"}</button
  >{#if shown}
    <Toast />
  {/if}
</section>
