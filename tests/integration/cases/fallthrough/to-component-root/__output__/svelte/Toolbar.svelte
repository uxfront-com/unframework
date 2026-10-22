<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Primary from "./Primary.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div role="toolbar" aria-label="Actions" class={className} {style} {...scopeAttributes(attributes)}>
  <Primary text="Save" class="wide" />
</div>
