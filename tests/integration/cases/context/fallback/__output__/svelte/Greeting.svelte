<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { LocaleKey } from "./LocaleProvider.svelte";
  import { getContext, hasContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { name: string; class?: ClassValue; style?: string };

  let { name, class: className, style, ...attributes }: Props = $props();

  const locale = hasContext(LocaleKey)
    ? getContext<(typeof LocaleKey)["__value"]>(LocaleKey)
    : "en";

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
>{locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})</p>
