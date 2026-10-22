<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Hint from "./Hint.svelte";
  import type { ClassValue } from "svelte/elements";
  import "./Banner.uf.tsx.css";

  type Props = { tip: string; class?: ClassValue; style?: string };

  let { tip, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["banner", className]} {style} data-uf-e25060c2="" {...scopeAttributes(attributes)}>
  <Hint text={tip} {...{ "data-uf-e25060c2": "" }} />
</div>
