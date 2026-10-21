<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Note from "./Note.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; note: string; class?: ClassValue; style?: string };

  let { title, note, class: className, style }: Props = $props();
</script>

<article class={["article", className]} {style} data-uf-15946226="">
  <h2 class="title" data-uf-15946226="">{title}</h2
  ><Note text={note} data-uf-15946226="" />
</article>
