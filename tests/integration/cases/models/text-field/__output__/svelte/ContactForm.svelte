<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let name = $state("Ada");
  let email = $state("");
</script>

<form aria-label="Contact" class={className} {style} bind:this={ref} {...attributes}>
  <label>Name <input bind:value={name} /></label
  ><label>Email <input type="email" bind:value={email} /></label
  ><output>{name} at {email || "no address"}</output
  ><button type="button" onclick={() => (name = "Grace")}>Use Grace</button>
</form>
