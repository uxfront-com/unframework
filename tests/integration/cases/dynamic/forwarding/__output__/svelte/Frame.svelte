<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Panel from "./Panel.svelte";
  import Card from "./Card.svelte";
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    label: string;
    wide: boolean;
    title?: Snippet;
    class?: ClassValue;
    style?: string;
  };

  let { label, wide, title, class: className, style, ...attributes }: Props = $props();

  const Component = $derived(wide ? Panel : Card);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["frame", className]} aria-label={label} {style} {...scopeAttributes(attributes)}>
  <Component {title} />
</section>
