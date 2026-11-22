<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Heading from "./Heading.svelte";
  import Status from "./Status.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Panel.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<section class={["panel", className]} {style} data-uf-34db6205="" bind:this={ref} {...attributes}>
  <Heading big={true} text="Release" {...{ "data-uf-34db6205": "" }}
  /><Heading big={false} text="Notes" {...{ "data-uf-34db6205": "" }}
  /><Status busy={false} text="Save" {...{ "data-uf-34db6205": "" }}
  /><Status busy={true} text="Save" {...{ "data-uf-34db6205": "" }} />
</section>
