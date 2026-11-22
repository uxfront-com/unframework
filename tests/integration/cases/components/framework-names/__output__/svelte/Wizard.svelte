<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import KeepAlive from "./KeepAlive.svelte";
  import Transition from "./Transition.svelte";
  import TransitionComponent from "./TransitionComponent.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<section aria-label="Wizard" class={className} {style} bind:this={ref} {...attributes}>
  <Transition step="details" /><TransitionComponent /><KeepAlive level={2} />
</section>
