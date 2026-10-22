<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Avatar from "./Avatar.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let picked = $state("none");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={className} {style} {...scopeAttributes(attributes)}>
  <Avatar imageURL="/a.png" userID={7} onpickedurl={(url) => (picked = url)}
  /><output>Picked: {picked}</output>
</div>
