<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Tag from "./Tag.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let active = $state(false);
</script>

<div class={["tags", className]} {style} bind:this={ref} {...attributes}>
  <Tag label="plain" /><Tag label="wide" class="wide" style="margin-left: 8px"
  /><Tag
    label="toggled"
    class={["picked", { active }]}
    style="color: {active ? "rgb(200, 0, 0)" : undefined}"
  /><button type="button" onclick={() => (active = !active)}>Toggle</button>
</div>
