<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Button from "./Button.svelte";
  import type { ClassValue } from "svelte/elements";
  import "./Toolbar.uf.tsx.css";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div
  role="toolbar"
  aria-label="Actions"
  class={["toolbar", className]}
  {style}
  data-uf-a33d603f=""
  {...scopeAttributes(attributes)}
>
  <Button text="Save" {...{ "data-uf-a33d603f": "" }}
  /><Button text="Cancel" {...{ "data-uf-a33d603f": "" }} />
</div>
