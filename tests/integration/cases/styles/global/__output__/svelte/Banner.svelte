<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Hint from "./Hint.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { tip: string; class?: ClassValue; style?: string };

  let { tip, class: className, style }: Props = $props();
</script>

<div class={["banner", className]} {style} data-uf-e25060c2="">
  <Hint text={tip} data-uf-e25060c2="" />
</div>
