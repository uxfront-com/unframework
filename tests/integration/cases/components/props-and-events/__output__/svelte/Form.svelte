<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Field from "./Field.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "city" | "children" | "class" | "style" | "ref"
  > & {
    city: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { city, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let cleared = $state("nothing");

  function clear(label: string) {
    cleared = label;
  }
</script>

<section aria-label="Address" class={className} {style} bind:this={ref} {...attributes}>
  <Field label="Street" onclear={clear}
  /><Field label={city} tone="warn" onclear={(label) => clear(label.toUpperCase())}
  /><output>Cleared: {cleared}</output>
</section>
