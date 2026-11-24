<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface PageProps {
    message: string;
  }
</script>

<script lang="ts">
  import Toast from "./Toast.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Page.uf.tsx.css";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "message" | "children" | "class" | "style" | "ref"
  > &
    PageProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let { message, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<section
  class={["page", className]}
  aria-label="Page"
  {style}
  data-uf-5a3bed67=""
  bind:this={ref}
  {...attributes}
>
  <p data-uf-5a3bed67="">Saving…</p
  ><Toast {message} {...{ "data-uf-5a3bed67": "" }} />
</section>
