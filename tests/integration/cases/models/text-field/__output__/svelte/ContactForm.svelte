<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let name = $state("Ada");
  let email = $state("");
</script>

<form aria-label="Contact" class={className} {style}>
  <label>Name <input bind:value={name} /></label
  ><label>Email <input type="email" bind:value={email} /></label
  ><output>{name} at {email || "no address"}</output
  ><button type="button" onclick={() => (name = "Grace")}>Use Grace</button>
</form>
