<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Heading from "./Heading.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; body: string; class?: ClassValue; style?: string };

  let { title, body, class: className, style }: Props = $props();
</script>

<section class={["section", className]} {style}>
  <Heading text={title}
  /><p>{body}</p>
</section>
