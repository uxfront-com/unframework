<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Heading from "./Heading.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; body: string; class?: ClassValue; style?: string };

  let { title, body, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["section", className]} {style} {...scopeAttributes(attributes)}>
  <Heading text={title}
  /><p>{body}</p>
</section>
