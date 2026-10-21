<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Heading from "./Heading.svelte";
  import Status from "./Status.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<section class={["panel", className]} {style} data-uf-34db6205="">
  <Heading big={true} text="Release" data-uf-34db6205=""
  /><Heading big={false} text="Notes" data-uf-34db6205=""
  /><Status busy={false} text="Save" data-uf-34db6205=""
  /><Status busy={true} text="Save" data-uf-34db6205="" />
</section>
