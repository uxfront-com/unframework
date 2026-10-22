<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export const LocaleKey = Symbol("uf.locale") as symbol & { readonly __value: string };
</script>

<script lang="ts">
  import { type Snippet, setContext, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { locale: string; children?: Snippet; class?: ClassValue; style?: string };

  let { locale, children, class: className, style, ...attributes }: Props = $props();

  setContext(
    LocaleKey,
    untrack(() => locale),
  );

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div
  lang={locale}
  class={className}
  {style}
  {...scopeAttributes(attributes)}
>{@render children?.()}</div>
