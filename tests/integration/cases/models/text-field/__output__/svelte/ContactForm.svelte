<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let name = $state("Ada");
  let email = $state("");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<form aria-label="Contact" class={className} {style} {...scopeAttributes(attributes)}>
  <label>Name <input bind:value={name} /></label
  ><label>Email <input type="email" bind:value={email} /></label
  ><output>{name} at {email || "no address"}</output
  ><button type="button" onclick={() => (name = "Grace")}>Use Grace</button>
</form>
