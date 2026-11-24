<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import SaveAction from "./SaveAction.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let clicks = $state(0);
  let save = $state<HTMLButtonElement | null>(null);
</script>

<div role="toolbar" aria-label="Actions" class={className} {style} bind:this={ref} {...attributes}>
  <SaveAction
    bind:ref={save}
    text="Save"
    id="save"
    aria-label="Save draft"
    onclick={() => clicks++}
  /><button type="button" onclick={() => save?.focus()}>Focus save</button
  ><p>Clicks: {clicks}</p>
</div>
