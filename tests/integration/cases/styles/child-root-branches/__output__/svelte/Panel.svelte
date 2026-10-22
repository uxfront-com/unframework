<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Heading from "./Heading.svelte";
  import Status from "./Status.svelte";
  import type { ClassValue } from "svelte/elements";
  import "./Panel.uf.tsx.css";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["panel", className]} {style} data-uf-34db6205="" {...scopeAttributes(attributes)}>
  <Heading big={true} text="Release" {...{ "data-uf-34db6205": "" }}
  /><Heading big={false} text="Notes" {...{ "data-uf-34db6205": "" }}
  /><Status busy={false} text="Save" {...{ "data-uf-34db6205": "" }}
  /><Status busy={true} text="Save" {...{ "data-uf-34db6205": "" }} />
</section>
