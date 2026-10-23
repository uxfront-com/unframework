<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Section from "./Section.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { name: string; class?: ClassValue; style?: string };

  let { name, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article aria-label="Profile" class={className} {style} {...scopeAttributes(attributes)}>
  <Section title={`About ${name}`} body="Three components deep."
  /><Section title="Contact" body={`Write to ${name}.`} />
</article>
