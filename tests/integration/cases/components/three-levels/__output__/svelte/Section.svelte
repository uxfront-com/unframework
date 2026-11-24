<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Heading from "./Heading.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "title" | "body" | "children" | "class" | "style" | "ref"
  > & {
    title: string;
    body: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    title,
    body,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section class={["section", className]} {style} bind:this={ref} {...attributes}>
  <Heading text={title}
  /><p>{body}</p>
</section>
