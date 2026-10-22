<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let agreed = $state(false);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Terms" class={className} {style} {...scopeAttributes(attributes)}>
  <label><input type="checkbox" bind:checked={agreed} /> I agree</label
  ><output>{agreed ? "Agreed" : "Not agreed"}</output
  ><button type="button" onclick={() => (agreed = !agreed)}>Toggle</button>
</section>
