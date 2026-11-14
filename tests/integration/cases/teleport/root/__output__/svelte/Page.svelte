<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface PageProps {
    message: string;
  }
</script>

<script lang="ts">
  import Toast from "./Toast.svelte";
  import type { ClassValue } from "svelte/elements";
  import "./Page.uf.tsx.css";

  type Props = PageProps & { class?: ClassValue; style?: string };

  let { message, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["page", className]}
  aria-label="Page"
  {style}
  data-uf-5a3bed67=""
  {...scopeAttributes(attributes)}
>
  <p data-uf-5a3bed67="">Saving…</p
  ><Toast {message} {...{ "data-uf-5a3bed67": "" }} />
</section>
