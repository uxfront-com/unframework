<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Section from "./Section.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "name" | "children" | "class" | "style" | "ref"
  > & {
    name: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["article"] | null;
  };

  let { name, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<article aria-label="Profile" class={className} {style} bind:this={ref} {...attributes}>
  <Section title={`About ${name}`} body="Three components deep."
  /><Section title="Contact" body={`Write to ${name}.`} />
</article>
