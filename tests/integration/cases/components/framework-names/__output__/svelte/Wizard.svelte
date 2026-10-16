<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Transition from "./Transition.svelte";
  import TransitionComponent from "./TransitionComponent.svelte";
  import KeepAlive from "./KeepAlive.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<section aria-label="Wizard" class={className} {style}>
  <Transition step="details" /><TransitionComponent /><KeepAlive level={2} />
</section>
