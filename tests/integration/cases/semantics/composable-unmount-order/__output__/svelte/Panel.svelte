<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useTeardown } from "./useTeardown.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    name: string;
    onclosed?: (entry: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { name, onclosed, class: className, style, ...attributes }: Props = $props();

  const teardown = useTeardown(
    () => name,
    (entry) => onclosed?.(entry),
  );

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["panel", className]}
  aria-label={teardown.title}
  {style}
  {...scopeAttributes(attributes)}
>
  <h2>{teardown.title}</h2>
</section>
