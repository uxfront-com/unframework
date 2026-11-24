<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Panel from "./Panel.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "name" | "children" | "class" | "style" | "ref" | "title"
  > & {
    name: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { name, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<Panel title="Welcome" class={className} {style} bind:ref {...attributes}>
  <p>Hello, <strong>{name}</strong>!</p
  ><p>Your children render in the panel.</p>
</Panel>
