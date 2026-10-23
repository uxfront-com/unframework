<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import KeepAlive from "./KeepAlive.svelte";
  import Transition from "./Transition.svelte";
  import TransitionComponent from "./TransitionComponent.svelte";
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

<section aria-label="Wizard" class={className} {style} {...scopeAttributes(attributes)}>
  <Transition step="details" /><TransitionComponent /><KeepAlive level={2} />
</section>
