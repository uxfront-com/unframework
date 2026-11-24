<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Member from "./Member.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "id" | "children" | "class" | "style" | "ref"
  > & { id: string; class?: ClassValue; style?: string };

  let { id, class: className, style, ...attributes }: Props = $props();
</script>

<Member {id} class={className} {style} {...attributes} />
