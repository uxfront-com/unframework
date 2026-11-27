<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Action from "./Action.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let linked = $state(true);
</script>

<section class={["page", className]} {style} bind:this={ref} {...attributes}>
  <Action href="#docs" label="Docs">Read the docs</Action
  ><Action label="Save">Save the draft</Action><Action href="#home" label="Home"
  /><Action label="Close"
  /><Action
    href={linked ? "#more" : undefined}
    label="More"
  >Learn more{#snippet icon()}<i aria-hidden="true">+</i>{/snippet}</Action
  ><button type="button" onclick={() => (linked = !linked)}>Toggle</button>
</section>
