<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import "virtual:styleframe.css";
  import "./Panel.uf.tsx.css";

  type Props = { text: string; class?: ClassValue; style?: string };

  let { text, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["panel", className]} {style} data-uf-b6be1fd3="" {...scopeAttributes(attributes)}>
  <p class="body" data-uf-b6be1fd3="">{text}</p>
</section>
