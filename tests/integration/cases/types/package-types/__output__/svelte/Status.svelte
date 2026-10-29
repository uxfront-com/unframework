<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Labelled } from "./types";
  import type { TimeInterval } from "rxjs";
  import type { ClassValue } from "svelte/elements";

  type StatusProps = TimeInterval<string> & Labelled;

  type Props = StatusProps & { class?: ClassValue; style?: string };

  let { value, interval, label, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<p
  class={className}
  {style}
  {...scopeAttributes(attributes)}
>{label}: {value} after {interval} ms</p>
