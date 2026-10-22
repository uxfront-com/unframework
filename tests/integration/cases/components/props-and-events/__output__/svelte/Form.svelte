<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Field from "./Field.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { city: string; class?: ClassValue; style?: string };

  let { city, class: className, style, ...attributes }: Props = $props();

  let cleared = $state("nothing");

  function clear(label: string) {
    cleared = label;
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Address" class={className} {style} {...scopeAttributes(attributes)}>
  <Field label="Street" onclear={clear}
  /><Field label={city} tone="warn" onclear={(label) => clear(label.toUpperCase())}
  /><output>Cleared: {cleared}</output>
</section>
